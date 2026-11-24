import { describe, expect, it } from 'vitest'
import { newBrief, type Brief } from '../schemas/briefs-schema'
import { TIMED_OUT } from './call-integration'
import {
  buildPickMessage,
  buildSearchQuery,
  explainPickError,
  explainSearchError,
  MAX_COMPETITORS,
  parseCompetitors,
  toSearchResults,
  type SearchResult,
} from './competitors'

const brief: Brief = {
  ...newBrief('https://github.com/honojs/hono', 'honojs', 'hono'),
  status: 'summarized',
  summary: 'Hono is a small web framework.',
}

const results: SearchResult[] = [
  { title: 'Hono vs Express', url: 'https://example.com/one', text: 'Express and Fastify are web frameworks.' },
  { title: 'Bun frameworks', url: 'https://example.com/two', text: 'Elysia runs on Bun.' },
]

/** Shorthand: the AI's reply as text. */
function reply(competitors: unknown[]): string {
  return JSON.stringify({ competitors })
}

describe('buildSearchQuery', () => {
  it('uses the repository name and the summary', () => {
    expect(buildSearchQuery(brief)).toBe('Alternatives and competitors to hono: Hono is a small web framework.')
  })

  it('is cut to a sensible length', () => {
    const long = { ...brief, summary: 'x'.repeat(5000) }
    expect(buildSearchQuery(long)).toHaveLength(400)
  })
})

describe('toSearchResults', () => {
  it('keeps the title, link, and text of each result', () => {
    const data = [{ title: 'A page', url: 'https://example.com/a', text: 'Some text', author: 'ignored' }]
    expect(toSearchResults(data, brief)).toEqual([
      { title: 'A page', url: 'https://example.com/a', text: 'Some text' },
    ])
  })

  it('drops results without a normal web link', () => {
    const data = [
      { title: 'Bad', url: 'javascript:alert(1)', text: '' },
      { title: 'No link', text: '' },
      null,
      'not an object',
    ]
    expect(toSearchResults(data, brief)).toEqual([])
  })

  it("leaves out the repository's own GitHub page", () => {
    const data = [{ title: 'hono', url: 'https://github.com/HonoJS/Hono/issues/1', text: '' }]
    expect(toSearchResults(data, brief)).toEqual([])
  })

  it('returns an empty list when the answer is not a list', () => {
    expect(toSearchResults(undefined, brief)).toEqual([])
    expect(toSearchResults({ results: 'nope' }, brief)).toEqual([])
  })

  it('cuts very long text', () => {
    const data = [{ title: 't'.repeat(999), url: 'https://example.com/a', text: 'x'.repeat(9999) }]
    const [page] = toSearchResults(data, brief)
    expect(page.title).toHaveLength(200)
    expect(page.text).toHaveLength(700)
  })
})

describe('buildPickMessage', () => {
  it('numbers the search results starting at 1', () => {
    const message = buildPickMessage(brief, results)
    expect(message).toContain('<product>')
    expect(message).toContain('What it does: Hono is a small web framework.')
    expect(message).toContain('[1] Hono vs Express')
    expect(message).toContain('[2] Bun frameworks')
    expect(message.endsWith('</search_results>')).toBe(true)
  })
})

describe('parseCompetitors', () => {
  it('takes the link from the search result, never from the AI', () => {
    const text = reply([
      { name: 'Express', description: 'A web framework.', source: 1, url: 'https://evil.example/made-up' },
    ])
    expect(parseCompetitors(text, results, brief)).toEqual([
      { name: 'Express', description: 'A web framework.', url: 'https://example.com/one' },
    ])
  })

  it('drops a competitor whose name is not on the page it points to', () => {
    const text = reply([
      { name: 'MadeUpCo', description: 'Invented.', source: 1 },
      { name: 'Elysia', description: 'On page 2, not page 1.', source: 1 },
      { name: 'Elysia', description: 'A Bun framework.', source: 2 },
    ])
    expect(parseCompetitors(text, results, brief)).toEqual([
      { name: 'Elysia', description: 'A Bun framework.', url: 'https://example.com/two' },
    ])
  })

  it('drops a competitor that points to a search result that does not exist', () => {
    const text = reply([
      { name: 'Express', description: 'x', source: 0 },
      { name: 'Express', description: 'x', source: 3 },
      { name: 'Express', description: 'x', source: 1.5 },
      { name: 'Express', description: 'x', source: '1' },
      { name: 'Express', description: 'x' },
    ])
    expect(parseCompetitors(text, results, brief)).toEqual([])
  })

  it('drops the product itself and repeats', () => {
    const text = reply([
      { name: 'Hono', description: 'The product itself.', source: 1 },
      { name: 'Express', description: 'First time.', source: 1 },
      { name: 'express', description: 'Second time.', source: 1 },
    ])
    expect(parseCompetitors(text, results, brief)).toEqual([
      { name: 'Express', description: 'First time.', url: 'https://example.com/one' },
    ])
  })

  it('drops entries with a missing name or description, and things that are not entries', () => {
    const text = reply([
      { description: 'No name.', source: 1 },
      { name: 'Express', source: 1 },
      { name: 42, description: ['x'], source: 1 },
      null,
      'Express',
    ])
    expect(parseCompetitors(text, results, brief)).toEqual([])
  })

  it('keeps at most five', () => {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf']
    const page: SearchResult[] = [{ title: 'List', url: 'https://example.com/list', text: names.join(', ') }]
    const text = reply(names.map((name) => ({ name, description: 'A tool.', source: 1 })))
    expect(parseCompetitors(text, page, brief)).toHaveLength(MAX_COMPETITORS)
  })

  it('returns an empty list when the AI found none', () => {
    expect(parseCompetitors('{"competitors": []}', results, brief)).toEqual([])
  })

  it('returns null when the reply is not the JSON we asked for', () => {
    expect(parseCompetitors('I cannot help with that.', results, brief)).toBeNull()
    expect(parseCompetitors('{"competitors": "Express"}', results, brief)).toBeNull()
    expect(parseCompetitors('{"competitors": [{"name": "cut off', results, brief)).toBeNull()
    expect(parseCompetitors(undefined, results, brief)).toBeNull()
  })
})

describe('error messages', () => {
  it('explains a timeout in each call', () => {
    expect(explainSearchError(TIMED_OUT)).toBe('The web search took too long. Please try again.')
    expect(explainPickError(TIMED_OUT)).toBe('The AI took too long to read the search results. Please try again.')
  })

  it('keeps the details for other errors', () => {
    expect(explainSearchError('exa/search (500)')).toContain('(Details: exa/search (500))')
    expect(explainPickError('anthropic (500)')).toContain('(Details: anthropic (500))')
  })
})
