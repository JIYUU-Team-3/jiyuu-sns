<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
</script>

<!-- Shown beside the name of an account that moderates Jiyuu. -->
<span class="mod" role="img" aria-label={m.moderator_badge()} title={m.moderator_badge()}>
	<Icon name="shield" size="xs" filled />
</span>

<style>
	.mod {
		display: inline-grid;
		place-items: center;
		flex: none;
		vertical-align: -2px;
		color: var(--accent-text);
	}
</style>
