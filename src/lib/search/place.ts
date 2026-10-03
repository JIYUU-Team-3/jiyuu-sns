/** Fewest letters a place search needs, so a stray letter doesn't match every location. */
export const PLACE_MIN = 3

/**
 * The part of a place name to search for: before the first comma, so `Phnom Penh, Cambodia` and
 * `Phnom Penh Municipality` find each other.
 */
export const place_key = (name: string) => name.split(',')[0].trim()
