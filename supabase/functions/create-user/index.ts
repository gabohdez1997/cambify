import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Check if the user making the request is an admin
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) throw new Error('Not authenticated')

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            throw new Error('Not authorized to create users')
        }

        // Now initialize the Admin Client with Service Role Key to bypass RLS and Auth rules
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse the payload from the request
        const payload = await req.json()
        const { action } = payload;

        if (action === 'update_password') {
            const { targetUserId, newPassword } = payload;
            if (!targetUserId || !newPassword) {
                throw new Error('Missing target user ID or new password');
            }

            // Bypass email checks to force reset password
            const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                targetUserId,
                { password: newPassword }
            );

            if (updateError) throw updateError;

            return new Response(
                JSON.stringify({ message: 'Password updated successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // Default action: Create User
        const { email, password, role } = payload;

        if (!email || !password || !role) {
            throw new Error('Missing email, password, or role')
        }

        // Create the user in Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Auto-confirm for admin creations
        });

        if (createError) throw createError;

        // Note: Our DB Trigger `handle_new_user` will automatically create the profile row with role 'user'.
        // If the admin requested to create an 'admin', we need to update that profile row now.
        if (role === 'admin' && newUser.user) {
            const { error: updateProfileError } = await supabaseAdmin
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', newUser.user.id);

            if (updateProfileError) throw updateProfileError;
        }

        return new Response(
            JSON.stringify({ message: 'User created successfully', user: newUser.user }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
