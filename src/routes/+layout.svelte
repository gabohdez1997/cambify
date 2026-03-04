<script lang="ts">
	import "../app.css";
	import ThemeToggle from "$lib/components/ThemeToggle.svelte";
</script>

<div class="app-container">
	<slot />
</div>

<!-- Global Floating Action Button for Theme -->
<div class="theme-fab">
	<ThemeToggle />
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.theme-fab {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 9999;
	}
</style>
