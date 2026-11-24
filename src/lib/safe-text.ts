/**
 * Two small safety checks for anything that comes from outside the app
 * (GitHub today, the AI and the search later).
 *
 * The rule: text from outside is only ever text. We never run it, and it
 * only becomes a clickable link if it is a normal web address.
 */

// Invisible "control" characters: everything below a space except tab and
// line break. Normal text has no use for them.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B-\u001F\u007F]/g

/**
 * Makes an outside value safe to save: it must be text, the invisible
 * characters are removed, and it is cut to a maximum length.
 * Anything that is not text becomes an empty string.
 */
export function cleanText(value: unknown, maxChars: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_CHARACTERS, '').slice(0, maxChars)
}

/**
 * True only for normal web addresses (http or https).
 * This blocks trick addresses such as "javascript:..." that would run code
 * when clicked.
 */
export function isWebLink(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
