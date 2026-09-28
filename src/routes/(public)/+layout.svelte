<script lang="ts">
	// Design tokens, the Khmer font and base element styles now live in src/app.css, shared with
	// the signed-in app.
	let { children } = $props()
</script>

<div class="public">{@render children()}</div>
