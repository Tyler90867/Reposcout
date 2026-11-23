import { describe, expect, it } from 'vitest'
import { parseGithubUrl } from './github-url'

describe('parseGithubUrl', () => {
  it('accepts a normal repo link', () => {
    expect(parseGithubUrl('https://github.com/facebook/react')).toEqual({
      ok: true,
      owner: 'facebook',
      repo: 'react',
      url: 'https://github.com/facebook/react',
    })
  })

  it('cleans up extra parts of the link', () => {
    const cleaned = { ok: true, owner: 'facebook', repo: 'react', url: 'https://github.com/facebook/react' }
    expect(parseGithubUrl('  https://github.com/facebook/react/  ')).toEqual(cleaned)
    expect(parseGithubUrl('https://github.com/facebook/react.git')).toEqual(cleaned)
    expect(parseGithubUrl('https://github.com/facebook/react/tree/main/packages')).toEqual(cleaned)
    expect(parseGithubUrl('github.com/facebook/react')).toEqual(cleaned)
    expect(parseGithubUrl('https://www.github.com/facebook/react?tab=readme')).toEqual(cleaned)
  })

  it('rejects empty input', () => {
    expect(parseGithubUrl('   ').ok).toBe(false)
  })

  it('rejects things that are not links', () => {
    expect(parseGithubUrl('hello world').ok).toBe(false)
  })

  it('rejects links to other websites', () => {
    expect(parseGithubUrl('https://gitlab.com/owner/repo').ok).toBe(false)
    expect(parseGithubUrl('https://github.com.evil.com/owner/repo').ok).toBe(false)
  })

  it('rejects a link with no repository name', () => {
    expect(parseGithubUrl('https://github.com/facebook').ok).toBe(false)
    expect(parseGithubUrl('https://github.com/').ok).toBe(false)
  })

  it('rejects names with characters GitHub does not allow', () => {
    expect(parseGithubUrl('https://github.com/face book/react').ok).toBe(false)
    expect(parseGithubUrl('https://github.com/owner/re$po').ok).toBe(false)
  })
})
