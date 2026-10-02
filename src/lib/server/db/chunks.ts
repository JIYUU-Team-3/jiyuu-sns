/**
 * D1 takes at most 100 bound parameters per query, so a long `in (…)` list is split. Each chunk
 * leaves room for the query's other parameters.
 */
export const IN_LIST_MAX = 90

export function chunks<T>(items: T[], size = IN_LIST_MAX): T[][] {
	const out: T[][] = []
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
	return out
}
