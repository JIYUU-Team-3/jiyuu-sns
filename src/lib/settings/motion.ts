/** Whether to calm animations: the device asks for it, or the Reduce motion setting is on. */
export const reduced_motion = () =>
	document.documentElement.dataset.motion === 'reduce' ||
	matchMedia('(prefers-reduced-motion: reduce)').matches
