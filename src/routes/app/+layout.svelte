<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabaseClient";
    import { LogOut, Settings } from "lucide-svelte";

    let loading = true;
    let isAuthenticated = false;
    let isAdmin = false;

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

            // Fetch user role to check if we should show the admin button
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (profile?.role === "admin") {
                isAdmin = true;
            }

            isAuthenticated = true;
        } catch (err) {
            console.error("Auth layout error:", err);
            goto("/login");
        } finally {
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
        <p>Verificando sesión...</p>
    </div>
{:else if isAuthenticated}
    <header class="app-header glass-panel">
        <div class="header-content">
            <h2
                style="font-size: 24px; margin: 0; display: flex; align-items: center; gap: 8px;"
            >
                <span style="font-size: 1.1em;">💸</span>
                <span class="glass-engraved-text">Cambify</span>
            </h2>
            <div style="display: flex; gap: 8px;">
                {#if isAdmin}
                    <button
                        class="btn btn-secondary"
                        on:click={() => goto("/admin/users")}
                        style="padding: 6px 12px; font-size: 13px;"
                        title="Panel Administrador"
                    >
                        <Settings size={16} />
                    </button>
                {/if}
                <button
                    class="btn btn-secondary"
                    on:click={signOut}
                    style="padding: 6px 12px; font-size: 13px;"
                    title="Cerrar Sesión"
                >
                    <LogOut size={16} style="margin-right: 4px;" /> Salir
                </button>
            </div>
        </div>
    </header>

    <main class="app-main">
        <slot />
    </main>
{/if}

<style>
    .app-header {
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

    .app-main {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
</style>
