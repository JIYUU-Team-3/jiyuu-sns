<script lang="ts">
	import { onMount } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { is_brave_desktop, is_ios, is_standalone, push } from './push.svelte'

	onMount(() => {
		push.check()
	})

	async function run(action: () => Promise<void>) {
		try {
			await action()
		} catch (error) {
			console.error(error)
			toast.show(m.toast_error())
		}
	}
</script>

{#if push.state !== 'checking' && push.state !== 'unsupported'}
	<section class="push" aria-labelledby="push-title">
		<span class="ico" class:on={push.state === 'on'}><Icon name="bell" /></span>
		<div class="text">
			<h2 id="push-title">{m.push_title()}</h2>
			<p>
				{#if push.state === 'on'}{m.push_on_body()}
				{:else if push.state === 'blocked'}{is_ios() && is_standalone()
						? m.push_blocked_ios()
						: m.push_blocked()}
				{:else if push.state === 'install'}{m.push_ios_hint()}
				{:else if push.state === 'update'}{m.push_ios_update()}
				{:else if push.state === 'unavailable'}{is_brave_desktop()
						? m.push_unavailable_brave()
						: m.push_unavailable()}
				{:else}{m.push_off_body()}{/if}
			</p>
		</div>
		{#if push.state === 'off' || push.state === 'unavailable'}
			<button
				type="button"
				class="btn btn-primary sm"
				disabled={push.busy}
				onclick={() => run(() => push.enable())}
				>{push.state === 'unavailable' ? m.feed_retry() : m.push_turn_on()}</button
			>
		{:else if push.state === 'on'}
			<button
				type="button"
				class="btn btn-outline sm"
				disabled={push.busy}
				onclick={() => run(() => push.disable())}>{m.push_turn_off()}</button
			>
		{/if}
	</section>
{/if}

<style>
	.push {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--bg-3);
		color: var(--text-2);
		flex: none;
	}
	.ico.on {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent-text);
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	h2 {
		font-size: 15px;
		font-weight: 700;
		margin: 0;
	}
	p {
		margin: 2px 0 0;
		color: var(--text-2);
		font-size: 14px;
	}
	.btn {
		flex: none;
	}
</style>
