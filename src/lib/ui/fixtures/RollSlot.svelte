<!-- A post action's column, sized by the row like `PostActions`, for measuring `NumberRoll`. -->
<script lang="ts">
	import NumberRoll from '../NumberRoll.svelte'

	let { value, text }: { value: number; text: string } = $props()
</script>

<span style="display: inline-flex; font: 13px system-ui">
	<span class="col" style="display: inline-flex; align-items: center; width: 77px">
		<span class="icon" style="display: inline-block; width: 34px; height: 34px"></span>
		<span class="cnt" style="font-variant-numeric: tabular-nums; white-space: nowrap">
			<NumberRoll {value} {text} anchor="start" />
		</span>
	</span>
	<span class="after">x</span>
</span>
