<script lang="ts">
	import { toast } from './toasts.svelte'
</script>

<div class="host" role="status" aria-live="polite">
	{#if toast.current}
		{#key toast.current.id}
			<div class="toast">
				<span>{toast.current.message}</span>
				{#if toast.current.action}
					<a href={toast.current.action.href}>{toast.current.action.label}</a>
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.host {
		position: fixed;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		z-index: 200;
		pointer-events: none;
	}
	.toast {
		background: var(--accent-fill);
		color: #fff;
		padding: 12px 16px;
		border-radius: 8px;
		box-shadow: var(--shadow-pop);
		display: flex;
		gap: 16px;
		align-items: center;
		font-size: 15px;
		pointer-events: auto;
		animation: toastin 0.32s var(--ease-out);
		white-space: nowrap;
	}
	a {
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	@keyframes toastin {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	@media (max-width: 700px) {
		.host {
			bottom: calc(76px + env(safe-area-inset-bottom));
		}
	}
</style>
