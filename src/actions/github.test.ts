import { describe, expect, it } from 'vitest'
import { TIMED_OUT } from './call-integration'
import { decodeReadme, explainGithubError, README_MAX_CHARS, toRepoFacts } from './github'

describe('decodeReadme', () => {
  it('turns base64 back into text, including line breaks GitHub adds', () => {
    // "# Hello\n" in base64, split across two lines the way GitHub sends it.
    expect(decodeReadme('IyBI\nZWxsbwo=\n')).toBe('# Hello\n')
  })

  it('keeps accents and emoji intact', () => {
    // "café ✓" in base64 (UTF-8).
    expect(decodeReadme('Y2Fmw6kg4pyT')).toBe('café ✓')
  })

  it('cuts very long READMEs', () => {
    const long = btoa('a'.repeat(README_MAX_CHARS + 500))
    expect(decodeReadme(long)).toHaveLength(README_MAX_CHARS)
  })

  it('returns an empty README instead of crashing on broken data', () => {
    expect(decodeReadme('this is not base64 !!!')).toBe('')
    expect(decodeReadme(undefined)).toBe('')
  })
})

describe('toRepoFacts', () => {
  it('keeps the normal fields from a real-looking answer', () => {
    const facts = toRepoFacts(
      {
        description: 'Web framework built on Web Standards',
        stargazers_count: 25000,
        language: 'TypeScript',
        homepage: 'https://hono.dev',
        topics: ['web', 'framework'],
      },
      '# Hono',
    )
    expect(facts).toEqual({
      description: 'Web framework built on Web Standards',
      stars: 25000,
      language: 'TypeScript',
      homepage: 'https://hono.dev',
      topics: ['web', 'framework'],
      readme: '# Hono',
    })
  })

  it('cleans up a hostile or broken answer', () => {
    const facts = toRepoFacts(
      {
        description: 'x'.repeat(5000),
        stargazers_count: 'lots',
        language: { not: 'text' },
        homepage: 'javascript:alert(1)',
        topics: ['ok', 42, 'a\u0000b', ...Array(100).fill('spam')],
      },
      '',
    )
    expect(facts.description).toHaveLength(500)
    expect(facts.stars).toBe(0)
    expect(facts.language).toBe('')
    expect(facts.homepage).toBe('')
    expect(facts.topics.length).toBeLessThanOrEqual(20)
    expect(facts.topics.slice(0, 3)).toEqual(['ok', 'ab', 'spam'])
  })

  it('copes with an empty answer', () => {
    expect(toRepoFacts({}, '')).toEqual({
      description: '',
      stars: 0,
      language: '',
      homepage: '',
      topics: [],
      readme: '',
    })
  })
})

describe('explainGithubError', () => {
  it('explains a missing or private repository', () => {
    // The real error text DeepSpace returned for a repository that does not exist.
    const raw =
      'github/get-repository (502, 777ms): GitHub public API error 404: {"message":"Not Found"}. ' +
      'Private account data requires a caller-owned GitHub connection through Composio.'
    const message = explainGithubError(raw)
    expect(message).toContain('could not find that repository')
    expect(message).toContain('private')
  })

  it('explains a timeout', () => {
    expect(explainGithubError(TIMED_OUT)).toContain('took too long')
  })

  it('explains a rate limit', () => {
    expect(explainGithubError('GitHub public API error 403: rate limit exceeded')).toContain('limiting requests')
  })

  it('keeps the details for anything else', () => {
    expect(explainGithubError('something odd')).toContain('something odd')
  })
})
