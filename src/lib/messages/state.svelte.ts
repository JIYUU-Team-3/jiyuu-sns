let open = $state(false)

export const new_message = {
	get open() {
		return open
	},
	show() {
		open = true
	},
	close() {
		open = false
	},
}
