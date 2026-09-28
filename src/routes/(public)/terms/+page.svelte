<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS } from '../links'
</script>

<DocPage title={m.terms_title()} updated>
	<p>{m.terms_intro()}</p>

	<h2>{m.terms_account_heading()}</h2>
	<p>{m.terms_account()}</p>
	<p>{m.terms_age()}</p>

	<h2>{m.terms_content_heading()}</h2>
	<p>{m.terms_content()}</p>

	<h2>{m.terms_rules_heading()}</h2>
	<p>{m.terms_rules_intro()}</p>
	<ul>
		<li>{m.terms_rule_harass()}</li>
		<li>{m.terms_rule_hate()}</li>
		<li>{m.terms_rule_illegal()}</li>
		<li>{m.terms_rule_spam()}</li>
	</ul>
	<p>{m.terms_enforcement()}</p>

	<h2>{m.terms_service_heading()}</h2>
	<p>{m.terms_service()}</p>
	<p>{m.terms_liability()}</p>

	<h2>{m.terms_law_heading()}</h2>
	<p>{m.terms_law()}</p>

	<h2>{m.terms_changes_heading()}</h2>
	<p>{m.terms_changes()}</p>
	<p><RichText parts={m.terms_contact.parts()} hrefs={EXTERNAL_HREFS} /></p>
</DocPage>
