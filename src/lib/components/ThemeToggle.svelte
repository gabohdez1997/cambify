<script lang="ts">
    import { onMount } from "svelte";
    import { Sun, Moon } from "lucide-svelte";

    let theme = "light";

    onMount(() => {
        // Retrieve explicit preference
        const savedTheme = localStorage.getItem("theme");

        if (savedTheme) {
            theme = savedTheme;
        } else {
            // Check system preference if no saved preference
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches;
            theme = prefersDark ? "dark" : "light";
        }

        applyTheme(theme);
    });

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        applyTheme(theme);
        localStorage.setItem("theme", theme);
    }

    function applyTheme(newTheme: string) {
        document.documentElement.setAttribute("data-theme", newTheme);
    }
</script>

<button class="theme-toggle" on:click={toggleTheme} aria-label="Cambiar tema">
    {#if theme === "light"}
        <Moon size={20} />
    {:else}
        <Sun size={20} />
    {/if}
</button>

<style>
    .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-color);
        border: 1px solid var(--surface-border);
        color: var(--text-color);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        z-index: 100;
    }

    .theme-toggle:hover {
        transform: scale(1.05);
        box-shadow: var(--shadow-md);
    }

    .theme-toggle:active {
        transform: scale(0.95);
    }
</style>
