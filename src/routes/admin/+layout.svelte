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

            // Fetch user profile
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("role, status")
                .eq("id", session.user.id)
                .single();

            if (error || !profile) {
                errorMsg = "Error cargando perfil o perfil no encontrado.";
                loading = false;
                return;
            }

            if (profile.status !== "active") {
                errorMsg = "Tu cuenta está deshabilitada.";
                loading = false;
                return;
            }

            // Route guard for /admin/users
            if (
                window.location.pathname.startsWith("/admin/users") &&
                profile.role !== "admin"
            ) {
                errorMsg =
                    "No tienes permisos de administrador para ver usuarios.";
                loading = false;
                return;
            }

            isAdmin = profile.role === "admin";
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
{:else}
    <header class="admin-header glass-panel">
        <div class="header-content">
            <h2
                style="font-size: 24px; margin: 0; display: flex; align-items: center; gap: 8px;"
            >
                <span style="font-size: 1.1em;">💸</span>
                <span class="glass-engraved-text">Cambify</span>
            </h2>
            <nav class="desktop-nav">
                <a
                    href="/admin/cash"
                    class="nav-link"
                    class:active={window.location.pathname === "/admin/cash"}
                    >Caja</a
                >
                {#if isAdmin}
                    <a
                        href="/admin/users"
                        class="nav-link"
                        class:active={window.location.pathname.startsWith(
                            "/admin/users",
                        )}>Usuarios</a
                    >
                {/if}
            </nav>
            <button
                class="btn btn-secondary"
                on:click={signOut}
                style="padding: 6px 12px; font-size: 13px;"
                ><LogOut size={16} style="margin-right: 4px;" /> Salir</button
            >
        </div>

        <!-- Mobile Navigation -->
        <nav class="mobile-nav">
            <a
                href="/admin/cash"
                class="nav-link"
                class:active={window.location.pathname === "/admin/cash"}
                >Caja</a
            >
            {#if isAdmin}
                <a
                    href="/admin/users"
                    class="nav-link"
                    class:active={window.location.pathname.startsWith(
                        "/admin/users",
                    )}>Usuarios</a
                >
            {/if}
        </nav>
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
        max-width: 800px;
        margin: 0 auto;
    }

    .desktop-nav {
        display: none;
        gap: 16px;
    }

    .mobile-nav {
        display: flex;
        gap: 16px;
        margin-top: 12px;
        justify-content: center;
        border-top: 1px solid var(--surface-border);
        padding-top: 12px;
    }

    @media (min-width: 600px) {
        .desktop-nav {
            display: flex;
            align-items: center;
        }
        .mobile-nav {
            display: none;
        }
    }

    .nav-link {
        color: var(--text-secondary);
        text-decoration: none;
        font-weight: 500;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s ease;
    }

    .nav-link:hover {
        background: rgba(120, 120, 128, 0.1);
        color: var(--text-color);
    }

    .nav-link.active {
        color: var(--text-color);
        background: var(--surface-border);
    }

    .admin-main {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
</style>
