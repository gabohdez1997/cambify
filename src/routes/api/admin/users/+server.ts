import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env as envPrivate } from '$env/dynamic/private';
import { env as envPublic } from '$env/dynamic/public';

// Initialize the Supabase Client with the Service Role Key to bypass RLS and act as admin
// Using lazy initialization for edge environments
const getSupabaseAdmin = () => {
    return createClient(envPublic.PUBLIC_SUPABASE_URL, envPrivate.SUPABASE_SERVICE_ROLE_KEY);
};

export async function POST({ request, locals }) {
    try {
        const body = await request.json();
        const { action, email, password, role, targetUserId, newPassword } = body;

        // 1. Password Reset Flow
        if (action === 'update_password') {
            if (!targetUserId || !newPassword) {
                return json({ error: 'Falta el ID de usuario o la nueva contraseña' }, { status: 400 });
            }

            const supabaseAdmin = getSupabaseAdmin();
            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
                targetUserId,
                { password: newPassword }
            );

            if (error) throw error;
            return json({ message: 'Contraseña actualizada exitosamente' });
        }


        // 2. Create User Flow
        if (action === 'create') {
            if (!email || !password || !role) {
                return json({ error: 'Faltan datos obligatorios (email, clave o rol)' }, { status: 400 });
            }

            const supabaseAdmin = getSupabaseAdmin();

            // Create user in Auth schema directly bypassing email confirmation
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (createError) throw createError;

            // If an Admin was requested, update their profile.
            // (The default DB trigger automatically creates them as 'user')
            if (role === 'admin' && newUser.user) {
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({ role: 'admin' })
                    .eq('id', newUser.user.id);

                if (profileError) throw profileError;
            }

            return json({ message: 'Usuario creado exitosamente', user: newUser.user });
        }

        return json({ error: 'Acción no válida' }, { status: 400 });

    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
}
