<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { rule_description, rule_label } from '#lib/moderation/labels'
	import {
		NEVER_ALLOWED,
		NOT_ALLOWED,
		STRIKE_SUSPENSION_DAYS,
		STRIKE_WINDOW_DAYS,
		STRIKES_TO_BAN,
		STRIKES_TO_SUSPEND,
	} from '#lib/moderation/rules'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS } from '../links'
</script>

<DocPage title={m.guidelines_title()}>
	<p>{m.guidelines_intro()}</p>

	<h2>{m.guidelines_never_heading()}</h2>
	<p>{m.guidelines_never_intro()}</p>
	<ul>
		{#each NEVER_ALLOWED as rule (rule)}
			<li><strong>{rule_label(rule)}.</strong> {rule_description(rule)}</li>
		{/each}
	</ul>

	<h2>{m.guidelines_not_allowed_heading()}</h2>
	<p>{m.guidelines_not_allowed_intro()}</p>
	<ul>
		{#each NOT_ALLOWED as rule (rule)}
			<li><strong>{rule_label(rule)}.</strong> {rule_description(rule)}</li>
		{/each}
	</ul>

	<h2>{m.guidelines_sensitive_heading()}</h2>
	<p>{m.guidelines_sensitive()}</p>

	<h2>{m.guidelines_allowed_heading()}</h2>
	<p>{m.guidelines_allowed()}</p>

	<h2>{m.guidelines_strikes_heading()}</h2>
	<ul>
		<li>{m.guidelines_strike_warning()}</li>
		<li>
			{m.guidelines_strike_suspend({
				strikes: STRIKES_TO_SUSPEND,
				window: STRIKE_WINDOW_DAYS,
				days: STRIKE_SUSPENSION_DAYS,
			})}
		</li>
		<li>{m.guidelines_strike_ban({ strikes: STRIKES_TO_BAN })}</li>
		<li>{m.guidelines_strike_severe()}</li>
	</ul>

	<h2>{m.guidelines_checks_heading()}</h2>
	<p>{m.guidelines_checks()}</p>

	<h2>{m.guidelines_appeals_heading()}</h2>
	<p>{m.guidelines_appeals()}</p>
	<p><RichText parts={m.guidelines_contact.parts()} hrefs={EXTERNAL_HREFS} /></p>
</DocPage>
