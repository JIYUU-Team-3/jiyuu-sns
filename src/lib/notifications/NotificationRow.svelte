<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_age, format_timestamp } from '#lib/posts/format'
	import { post_href } from '#lib/posts/links'
	import PostCard from '#lib/posts/PostCard.svelte'
	import { current_time } from '#lib/posts/state.svelte'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import { rule_label } from '#lib/moderation/labels'
	import Icon from '#lib/ui/Icon.svelte'
	import type { NotificationView } from './types'

	let { item }: { item: NotificationView } = $props()

	const href = $derived.by(() => {
		if (item.type === 'follow')
			return item.actor.handle ? profile_href(item.actor.handle) : undefined
		return item.post_id ? post_href(item.post_id) : undefined
	})
	const message = $derived(item.type === 'like' ? m.notifications_like : m.notifications_follow)

	/** A moderator's action, told without naming the moderator: the post page has the details. */
	const moderation_text = $derived.by(() => {
		const notice = item.moderation
		if (!notice) return ''
		if (notice.action === 'restore') return m.notifications_moderation_restore()
		if (notice.review_refused) return m.notifications_moderation_review_refused()
		const rule = notice.reason ? rule_label(notice.reason) : undefined
		if (notice.action === 'remove')
			return rule
				? m.notifications_moderation_remove({ rule })
				: m.notifications_moderation_remove_plain()
		return m.notifications_moderation_limit()
	})

	/** Like a post card, the whole row opens its target unless the click hit a link. */
	function open(event: MouseEvent) {
		if ((event.target as Element).closest('a, button')) return
		if (href) goto(href)
	}
</script>

{#if item.moderation}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="nrow" class:unread={item.unread} onclick={open}>
		<div class="n-ico moderation"><Icon name="shield" size="lg" /></div>
		<div class="n-body">
			<p class="n-text">
				{#if href}<a class="nm" {href}>{moderation_text}</a>{:else}{moderation_text}{/if}
				<span class="time" title={format_timestamp(item.created_at, getLocale())}
					>· {format_age(item.created_at, current_time(), getLocale())}</span
				>
			</p>
		</div>
	</div>
{:else if item.post}
	<div class:unread={item.unread}><PostCard post={item.post} /></div>
{:else}
	<!-- The name link is the keyboard path; the row click is a pointer shortcut. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="nrow" class:unread={item.unread} onclick={open}>
		<div class="n-ico {item.type}">
			<Icon name={item.type === 'like' ? 'heart' : 'user'} size="lg" filled />
		</div>
		<div class="n-body">
			{#if item.actor.handle}
				<a class="av" href={profile_href(item.actor.handle)} tabindex="-1" aria-hidden="true">
					<Avatar name={item.actor.name} seed={item.actor.id} image={item.actor.image} size={32} />
				</a>
			{:else}
				<Avatar name={item.actor.name} seed={item.actor.id} image={item.actor.image} size={32} />
			{/if}
			<p class="n-text">
				{#each message.parts() as part, i (i)}
					{#if part.type === 'text'}{part.value}{:else if part.name === 'name'}{#if href}<a
								class="nm"
								{href}>{item.actor.name}</a
							>{:else}<b>{item.actor.name}</b>{/if}{/if}
				{/each}
				<span class="time" title={format_timestamp(item.created_at, getLocale())}
					>· {format_age(item.created_at, current_time(), getLocale())}</span
				>
			</p>
			{#if item.snippet}<p class="n-snip">{item.snippet}</p>{/if}
		</div>
	</div>
{/if}

<style>
	.nrow {
		display: flex;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.nrow:hover {
		background: var(--bg-2);
	}
	.unread {
		background: color-mix(in srgb, var(--accent) 7%, transparent);
	}
	.n-ico {
		width: 40px;
		display: flex;
		justify-content: flex-end;
		flex: none;
		padding-top: 2px;
	}
	.n-ico.like {
		color: var(--like);
	}
	.n-ico.follow {
		color: var(--accent-text);
	}
	.n-ico.moderation {
		color: var(--text-2);
	}
	.n-body {
		flex: 1;
		min-width: 0;
	}
	.av {
		display: inline-flex;
	}
	.n-text {
		margin: 8px 0 0;
		overflow-wrap: anywhere;
	}
	/* No avatar above the text here, so its first line sits level with the icon instead. */
	.n-ico.moderation + .n-body .n-text {
		margin-top: 4px;
	}
	.nm {
		font-weight: 700;
	}
	.nm:hover {
		text-decoration: underline;
	}
	.time {
		color: var(--text-2);
	}
	.n-snip {
		color: var(--text-2);
		margin: 6px 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
