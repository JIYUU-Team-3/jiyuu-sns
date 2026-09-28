<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { TEAM, type Role } from './team'

	const ROLE_LABELS: Record<Role, () => string> = {
		lead: m.about_role_lead,
		backend: m.about_role_backend,
		design: m.about_role_design,
		devops: m.about_role_devops,
		testing: m.about_role_testing,
	}

	const github_href = (handle: string) => `https://github.com/${handle}`
	/** GitHub's mark, on a 16x16 grid. */
	const GITHUB_MARK =
		'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z'
	const photo_src = (handle: string) => `https://github.com/${handle}.png?size=80`

	const hide = (event: Event & { currentTarget: Element }) => {
		event.currentTarget.toggleAttribute('hidden', true)
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- links leave the app or go to routes not built yet -->
<section class="panel" aria-labelledby="team-panel">
	<h3 id="team-panel">{m.about_team_panel()}</h3>
	<ul>
		{#each TEAM as member (member.handle)}
			<li class="urow">
				<span class="pfp" aria-hidden="true">
					<span class="av" style:--h={member.hue}>
						{member.name[0]}
						<img
							src={photo_src(member.handle)}
							alt=""
							width="40"
							height="40"
							loading="lazy"
							onerror={hide}
						/>
					</span>
					<svg class="badge" viewBox="0 0 16 16"><path d={GITHUB_MARK} /></svg>
				</span>
				<div class="info">
					<div class="nm">
						<span class="jy">{member.name}</span>
						<span class="gh">{member.github_name ?? member.handle}</span>
					</div>
					<div class="hd">
						<span class="jy">@{member.jiyuu}</span>
						<span class="gh">@{member.handle}</span>
					</div>
					<div class="bio">{ROLE_LABELS[member.role]()}</div>
				</div>
				<div class="actions">
					<a
						class="btn-outline btn-icon"
						href={github_href(member.handle)}
						title="GitHub"
						aria-label={m.about_team_github({ name: member.name })}
					>
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path d={GITHUB_MARK} />
						</svg>
					</a>
					<a
						class="btn-outline"
						href={profile_href(member.jiyuu)}
						title={m.about_team_sign_in()}
						aria-label={m.about_team_jiyuu({ name: member.name })}>{m.about_team_view()}</a
					>
				</div>
			</li>
		{/each}
	</ul>
</section>

<style>
	.panel {
		border: 1px solid var(--line);
		border-radius: 16px;
		margin: 16px 0;
		overflow: hidden;
	}
	.panel h3 {
		font-size: 19px;
		font-weight: 800;
		letter-spacing: -0.01em;
		margin: 0;
		padding: 12px 16px 6px;
	}
	.panel ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.panel .urow {
		margin: 0;
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 12px 16px;
	}
	.panel .pfp {
		position: relative;
		flex: none;
	}
	.panel .av {
		width: 40px;
		height: 40px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: hsl(var(--h) var(--av-s) var(--av-l));
		color: hsl(var(--h) 45% var(--av-tl));
		font-weight: 700;
		font-size: 15px;
		user-select: none;
		position: relative;
		overflow: hidden;
	}
	.panel .av img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.panel .gh {
		display: none;
	}
	.panel .urow:has(.btn-icon:hover, .btn-icon:focus-visible) .jy {
		display: none;
	}
	.panel .urow:has(.btn-icon:hover, .btn-icon:focus-visible) .gh {
		display: inline;
	}
	.panel .urow:has(.btn-icon:hover, .btn-icon:focus-visible) .av img {
		opacity: 1;
	}
	.panel .badge {
		position: absolute;
		right: -3px;
		bottom: -3px;
		width: 18px;
		height: 18px;
		padding: 1px;
		border-radius: 50%;
		background: var(--bg);
		fill: var(--text);
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity 0.15s,
			transform 0.15s;
	}
	.panel .urow:has(.btn-icon:hover, .btn-icon:focus-visible) .badge {
		opacity: 1;
		transform: none;
	}
	.panel .info {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.panel .nm {
		font-weight: 700;
	}
	.panel .nm,
	.panel .hd {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.panel .hd {
		color: var(--text-2);
	}
	.panel .bio {
		margin-top: 4px;
	}
	.panel .btn-outline {
		display: inline-flex;
		align-items: center;
		height: 32px;
		margin-top: 2px;
		padding: 0 14px;
		border: 1px solid var(--line-2);
		border-radius: 999px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		white-space: nowrap;
		transition: background-color 0.15s;
	}
	.panel .actions {
		display: flex;
		gap: 8px;
		flex: none;
	}
	.panel .btn-icon {
		width: 32px;
		padding: 0;
		justify-content: center;
	}
	.panel .btn-icon svg {
		width: 16px;
		height: 16px;
		fill: currentColor;
	}
	.panel .btn-outline:hover {
		background: var(--bg-2);
		text-decoration: none;
	}
</style>
