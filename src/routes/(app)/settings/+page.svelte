<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import PushToggle from '#lib/notifications/PushToggle.svelte'
	import { push } from '#lib/notifications/push.svelte'
	import AccentPicker from '#lib/settings/AccentPicker.svelte'
	import { desktop } from '#lib/settings/clear.svelte'
	import LanguagePicker from '#lib/settings/LanguagePicker.svelte'
	import { prefs } from '#lib/settings/prefs.svelte'
	import SettingsSection from '#lib/settings/SettingsSection.svelte'
	import SwitchRow from '#lib/settings/SwitchRow.svelte'
	import ThemePicker from '#lib/settings/ThemePicker.svelte'
	import PageBar from '../PageBar.svelte'
	import AboutLinks from './AboutLinks.svelte'
	import AccountRows from './AccountRows.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<svelte:head><title>{m.site_page_title({ page: m.settings_title() })}</title></svelte:head>

<PageBar title={m.settings_title()} back />

<SettingsSection id="settings-account" title={m.settings_account()}>
	<AccountRows me={data.me} email={data.email} />
</SettingsSection>

<SettingsSection id="settings-display" title={m.settings_display()}>
	<ThemePicker />
	<AccentPicker />
	<!-- Not rendered at all off desktop; the server never renders it either. -->
	{#if desktop.current}
		<SwitchRow
			icon="glass"
			label={m.settings_clear()}
			sub={m.settings_clear_sub()}
			checked={prefs.value.clear}
			onchange={(on) => prefs.set('clear', on)}
		/>
	{/if}
</SettingsSection>

<SettingsSection id="settings-accessibility" title={m.settings_accessibility()}>
	<SwitchRow
		icon="play"
		label={m.settings_autoplay()}
		sub={m.settings_autoplay_sub()}
		checked={prefs.value.autoplay}
		onchange={(on) => prefs.set('autoplay', on)}
	/>
	<SwitchRow
		icon="wind"
		label={m.settings_reduce_motion()}
		sub={m.settings_reduce_motion_sub()}
		checked={prefs.value.reduce_motion}
		onchange={(on) => prefs.set('reduce_motion', on)}
	/>
</SettingsSection>

<SettingsSection id="settings-language" title={m.settings_language()}>
	<LanguagePicker />
</SettingsSection>

<SettingsSection id="settings-notifications" title={m.settings_notifications()}>
	<div class="notify">
		<PushToggle />
		{#if push.state === 'unsupported'}<p class="note">{m.settings_push_unsupported()}</p>{/if}
	</div>
</SettingsSection>

<SettingsSection id="settings-about" title={m.settings_about()}>
	<AboutLinks />
</SettingsSection>

<style>
	/* PushToggle draws its own rule for the notifications page; the section has one already. */
	.notify :global(.push) {
		border-bottom: 0;
	}
	.note {
		margin: 0;
		padding: 4px 16px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
