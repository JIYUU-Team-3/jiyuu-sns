<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS } from '../links'
</script>

<DocPage title={m.a11y_title()} updated>
	<p>{m.a11y_intro()}</p>

	<h2>{m.a11y_goal_heading()}</h2>
	<p><RichText parts={m.a11y_goal.parts()} hrefs={EXTERNAL_HREFS} /></p>

	<h2>{m.a11y_done_heading()}</h2>
	<ul>
		<li>{m.a11y_done_semantic()}</li>
		<li>{m.a11y_done_labels()}</li>
		<li>{m.a11y_done_focus()}</li>
		<li>{m.a11y_done_theme()}</li>
		<li>{m.a11y_done_lang()}</li>
		<li>{m.a11y_done_responsive()}</li>
	</ul>

	<h2>{m.a11y_limits_heading()}</h2>
	<ul>
		<li>{m.a11y_limit_audit()}</li>
		<li>{m.a11y_limit_google()}</li>
		<li>{m.a11y_limit_translation()}</li>
	</ul>

	<h2>{m.a11y_feedback_heading()}</h2>
	<p><RichText parts={m.a11y_feedback.parts()} hrefs={EXTERNAL_HREFS} /></p>
</DocPage>
