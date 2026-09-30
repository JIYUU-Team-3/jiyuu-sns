<script lang="ts">
	let {
		name,
		label,
		value = $bindable(''),
		max,
		counted = false,
		multiline = false,
		prefix,
		placeholder,
		invalid = false,
		describedby,
		autocomplete = 'off',
		autofocus = false,
		rows = 2,
	}: {
		name: string
		label: string
		value?: string
		max: number
		/** Show a live `used / max` count beside the label. */
		counted?: boolean
		multiline?: boolean
		prefix?: string
		placeholder?: string
		invalid?: boolean
		/** Id of the hint under the field, read out with it. */
		describedby?: string
		autocomplete?: HTMLInputElement['autocomplete']
		/** Where focus starts when the field opens in a modal. */
		autofocus?: boolean
		rows?: number
	} = $props()
</script>

<label class="field" class:err={invalid}>
	<span class="lbl">
		{label}
		{#if counted}<span class="num" aria-hidden="true">{value.length} / {max}</span>{/if}
	</span>
	{#if multiline}
		<textarea
			{name}
			{rows}
			maxlength={max}
			data-autofocus={autofocus || undefined}
			{placeholder}
			aria-describedby={describedby}
			bind:value></textarea>
	{:else}
		<span class="prefix">
			{#if prefix}<span aria-hidden="true">{prefix}</span>{/if}
			<input
				{name}
				maxlength={max}
				{placeholder}
				{autocomplete}
				data-autofocus={autofocus || undefined}
				spellcheck="false"
				aria-invalid={invalid}
				aria-describedby={describedby}
				bind:value
			/>
		</span>
	{/if}
</label>

<style>
	.field {
		display: block;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		padding: 6px 10px 8px;
		margin-bottom: 16px;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.field:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.field.err {
		border-color: var(--danger);
	}
	.field.err:focus-within {
		box-shadow: 0 0 0 1px var(--danger);
	}
	.lbl {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--text-2);
	}
	.field:focus-within .lbl {
		color: var(--accent-text);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.prefix {
		display: flex;
		align-items: baseline;
		gap: 2px;
	}
	.prefix > span {
		color: var(--text-2);
		font-size: 17px;
	}
	input,
	textarea {
		/* Controls clip at their padding box, so glyphs that overhang it (the tail of
		   a leading "j") get cut. Pad the sides and bottom, then pull the box back out
		   by the same amount so the text stays where it was. */
		width: calc(100% + 8px);
		margin: 0 -4px -2px;
		border: 0;
		outline: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 17px;
		padding: 2px 4px 2px;
		resize: none;
	}
	/* The whole field lights up on focus, so the layout's focus ring would draw a second box. */
	.field input:focus-visible,
	.field textarea:focus-visible {
		outline: none;
	}
</style>
