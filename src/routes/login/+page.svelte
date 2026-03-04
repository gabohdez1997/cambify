<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabaseClient";
    import { Mail, Lock, LogIn } from "lucide-svelte"; // Added Icons

    let email = "";
    let password = "";
    let loading = false;
    let errorMsg = "";

    onMount(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            goto("/admin"); // Or to home based on role later
        }
    });

    async function handleLogin(e: Event) {
        e.preventDefault();
        loading = true;
        errorMsg = "";

        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            errorMsg = error.message;
            loading = false;
            return;
        }

        if (data.session) {
            goto("/admin");
        }

        loading = false;
    }
</script>

<div class="login-container container">
    <div class="glass-panel login-card">
        <h1
            class="page-title glass-engraved-text"
            style="text-align: center; margin-bottom: 8px; font-size: 40px;"
        >
            Cambify
        </h1>
        <p class="subtitle">Ingresa a tu cuenta</p>

        {#if errorMsg}
            <div class="error-message">{errorMsg}</div>
        {/if}

        <form on:submit={handleLogin} class="login-form">
            <div class="input-group">
                <label class="input-label" for="email">Correo Electrónico</label
                >
                <div class="input-icon-wrapper">
                    <Mail class="input-icon" size={20} />
                    <input
                        id="email"
                        type="email"
                        class="input-field with-icon"
                        placeholder="tucorreo@ejemplo.com"
                        bind:value={email}
                        required
                    />
                </div>
            </div>

            <div class="input-group">
                <label class="input-label" for="password">Contraseña</label>
                <div class="input-icon-wrapper">
                    <Lock class="input-icon" size={20} />
                    <input
                        id="password"
                        type="password"
                        class="input-field with-icon"
                        placeholder="••••••••"
                        bind:value={password}
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                class="btn btn-primary login-btn"
                disabled={loading}
            >
                {#if loading}
                    Cargando...
                {:else}
                    <LogIn size={20} style="margin-right: 8px;" /> Iniciar Sesión
                {/if}
            </button>
        </form>
    </div>
</div>

<style>
    .login-container {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-height: 100vh;
    }

    .login-card {
        width: 100%;
        padding: 32px 24px;
    }

    .subtitle {
        text-align: center;
        color: var(--text-secondary);
        margin-bottom: 32px;
        font-size: 16px;
    }

    .login-form {
        display: flex;
        flex-direction: column;
    }

    .login-btn {
        margin-top: 16px;
        width: 100%;
        padding: 14px;
    }

    .error-message {
        background-color: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 24px;
        font-size: 14px;
        text-align: center;
    }
</style>
