<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabaseClient";

    onMount(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            goto("/admin/cash");
        } else {
            goto("/login");
        }
    });
</script>

<div
    class="container"
    style="display: flex; align-items: center; justify-content: center; height: 100vh;"
>
    <p>Redirigiendo...</p>
</div>
