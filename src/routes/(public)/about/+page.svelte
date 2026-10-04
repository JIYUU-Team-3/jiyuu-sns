<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS } from '../links'
	import TeamPanel from './TeamPanel.svelte'

	let { data } = $props()
</script>

<DocPage title={m.about_title()}>
	<p>{m.about_intro()}</p>

	<h2>{m.about_origin_heading()}</h2>
	<p>{m.about_origin()}</p>

	<h2>{m.about_team_heading()}</h2>
	<p>{m.about_team()}</p>
	<TeamPanel live={data.live} signed_in={data.signed_in} />

	<h2>{m.about_tech_heading()}</h2>
	<p><RichText parts={m.about_tech.parts()} hrefs={EXTERNAL_HREFS} /></p>

	<h2>{m.about_contact_heading()}</h2>
	<p><RichText parts={m.about_contact.parts()} hrefs={EXTERNAL_HREFS} /></p>
</DocPage>
