import { localizeHref } from '#lib/paraglide/runtime'

export const messages_href = () => localizeHref('/messages')

export const conversation_href = (id: string) => localizeHref(`/messages/${id}`)
