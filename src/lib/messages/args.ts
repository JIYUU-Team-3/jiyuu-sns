export const conversations_arg = (cursor?: string) => (cursor ? { cursor } : {})

export const messages_arg = (id: string, cursor?: string) => (cursor ? { id, cursor } : { id })
