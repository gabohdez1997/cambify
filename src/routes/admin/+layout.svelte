<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabaseClient";
    import { LogOut } from "lucide-svelte";

    let loading = true;
    let isAdmin = false;
    let errorMsg = "";

    onMount(async () => {
        try {
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (!session) {
                goto("/login");
                return;
            }

            // Fetch user role
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (error) {
                errorMsg = "Error cargando perfil: " + error.message;
                loading = false;
                return;
            }

            if (!profile || profile.role !== "admin") {
                errorMsg =
                    "No tienes permisos de administrador. Rol actual: " +
                    (profile?.role || "Ninguno");
                loading = false;
                return;
            }

            isAdmin = true;
            loading = false;
        } catch (err: any) {
            errorMsg = "Error inesperado: " + err.message;
            loading = false;
        }
    });

    async function signOut() {
        await supabase.auth.signOut();
        goto("/login");
    }
</script>

{#if loading}
    <div
        class="container"
        style="display: flex; align-items: center; justify-content: center; height: 100vh;"
    >
        <p>Verificando permisos...</p>
    </div>
{:else if errorMsg}
    <div
        class="container"
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 16px;"
    >
        <div class="glass-panel" style="padding: 24px; text-align: center;">
            <p style="color: #FF3B30; margin-bottom: 16px;">{errorMsg}</p>
            <button class="btn btn-secondary" on:click={signOut}
                >Cerrar Sesión y Volver</button
            >
        </div>
    </div>
{:else if isAdmin}
    <header class="admin-header glass-panel">
        <div class="header-content">
            <h2
                style="font-size: 24px; margin: 0; display: flex; align-items: center; gap: 8px;"
            >
                <span style="font-size: 1.1em;">💸</span>
                <span class="glass-engraved-text">Cambify</span>
            </h2>
            <button
                class="btn btn-secondary"
                on:click={signOut}
                style="padding: 6px 12px; font-size: 13px;"
                ><LogOut size={16} style="margin-right: 4px;" /> Salir</button
            >
        </div>
    </header>

    <main class="admin-main">
        <slot />
    </main>
{/if}

<style>
    .admin-header {
        position: sticky;
        top: 0;
        z-index: 10;
        border-radius: 0;
        border-left: none;
        border-right: none;
        border-top: none;
        padding: 12px 16px;
    }

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 480px;
        margin: 0 auto;
    }

    .admin-main {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
</style>
