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

let changes = $state(0)
let connected = () => false

export const inbox = {
	get changes() {
		return changes
	},
	get open() {
		return connected()
	},
	follow(open: () => boolean) {
		connected = open
	},
	changed() {
		changes++
	},
}
