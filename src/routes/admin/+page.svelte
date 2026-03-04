<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        goto("/admin/users");
    });
</script>

<div
    class="container"
    style="display: flex; align-items: center; justify-content: center; height: 100%;"
>
    <p>Redirigiendo a usuarios...</p>
</div>
