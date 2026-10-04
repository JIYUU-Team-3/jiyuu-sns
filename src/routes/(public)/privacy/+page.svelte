<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS, localized } from '../links'
</script>

<DocPage title={m.privacy_title()} updated>
	<p>{m.privacy_intro()}</p>

	<h2>{m.privacy_collect_heading()}</h2>
	<ul>
		<li>{m.privacy_collect_google()}</li>
		<li>{m.privacy_collect_session()}</li>
		<li>{m.privacy_collect_content()}</li>
		<li>{m.privacy_collect_photos()}</li>
		<li>{m.privacy_collect_places()}</li>
		<li>{m.privacy_collect_links()}</li>
	</ul>

	<h2>{m.privacy_use_heading()}</h2>
	<p>{m.privacy_use()}</p>

	<h2>{m.privacy_public_heading()}</h2>
	<p>{m.privacy_public()}</p>

	<h2>{m.privacy_cookies_heading()}</h2>
	<p>{m.privacy_cookies_intro()}</p>
	<ul>
		<li>{m.privacy_cookie_session()}</li>
		<li>{m.privacy_cookie_state()}</li>
		<li>{m.privacy_cookie_locale()}</li>
	</ul>
	<p>{m.privacy_storage_emoji()}</p>

	<h2>{m.privacy_providers_heading()}</h2>
	<p><RichText parts={m.privacy_providers.parts()} hrefs={EXTERNAL_HREFS} /></p>
	<p><RichText parts={m.privacy_providers_giphy.parts()} hrefs={EXTERNAL_HREFS} /></p>
	<p><RichText parts={m.privacy_providers_places.parts()} hrefs={EXTERNAL_HREFS} /></p>
	<p>{m.privacy_providers_links()}</p>
	<p><RichText parts={m.privacy_providers_translate.parts()} hrefs={EXTERNAL_HREFS} /></p>
	<p><RichText parts={m.privacy_providers_emoji.parts()} hrefs={EXTERNAL_HREFS} /></p>
	<p>
		<RichText
			parts={m.privacy_providers_github.parts()}
			hrefs={{ ...EXTERNAL_HREFS, about: localized('/about') }}
		/>
	</p>

	<h2>{m.privacy_retention_heading()}</h2>
	<p>{m.privacy_retention()}</p>

	<h2>{m.privacy_rights_heading()}</h2>
	<p><RichText parts={m.privacy_rights.parts()} hrefs={EXTERNAL_HREFS} /></p>

	<h2>{m.privacy_children_heading()}</h2>
	<p>{m.privacy_children()}</p>

	<h2>{m.privacy_changes_heading()}</h2>
	<p>{m.privacy_changes()}</p>
</DocPage>
