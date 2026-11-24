import { describe, expect, it } from 'vitest'
import { cleanText, isWebLink } from './safe-text'

describe('cleanText', () => {
  it('keeps normal text, including line breaks and accents', () => {
    expect(cleanText('Hello\ncafé ✓', 100)).toBe('Hello\ncafé ✓')
  })

  it('removes invisible control characters', () => {
    expect(cleanText('a\u0000b\u0007c\u001Bd', 100)).toBe('abcd')
  })

  it('cuts text that is too long', () => {
    expect(cleanText('a'.repeat(50), 10)).toHaveLength(10)
  })

  it('turns anything that is not text into an empty string', () => {
    expect(cleanText(null, 10)).toBe('')
    expect(cleanText(42, 10)).toBe('')
    expect(cleanText({ evil: true }, 10)).toBe('')
  })
})

describe('isWebLink', () => {
  it('accepts normal web addresses', () => {
    expect(isWebLink('https://hono.dev')).toBe(true)
    expect(isWebLink('http://example.com/page')).toBe(true)
  })

  it('rejects addresses that would run code or open files', () => {
    expect(isWebLink('javascript:alert(1)')).toBe(false)
    expect(isWebLink('  JavaScript:alert(1)')).toBe(false)
    expect(isWebLink('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isWebLink('file:///C:/Windows/system32')).toBe(false)
  })

  it('rejects things that are not addresses at all', () => {
    expect(isWebLink('')).toBe(false)
    expect(isWebLink('hono.dev')).toBe(false)
  })
})
