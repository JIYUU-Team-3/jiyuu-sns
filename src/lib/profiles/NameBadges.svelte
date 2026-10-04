<script lang="ts">
	import ModeratorBadge from '#lib/moderation/ModeratorBadge.svelte'
	import VerifiedBadge from './VerifiedBadge.svelte'

	let { of }: { of: { moderator?: boolean; verified?: boolean } } = $props()
</script>

{#if of.verified}<VerifiedBadge />{/if}{#if of.moderator}<ModeratorBadge />{/if}
