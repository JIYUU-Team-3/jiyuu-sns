<script lang="ts">
	import FollowsPage from '../FollowsPage.svelte'
	import type { PageProps } from './$types'

	let { params }: PageProps = $props()
</script>

<FollowsPage handle={params.handle} side="following" />
