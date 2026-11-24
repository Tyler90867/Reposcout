/**
 * Tests for the whole generateBrief flow, with nothing real behind it.
 *
 * "Fake tools" stand in for DeepSpace: briefs live in a Map, usage records in
 * an array, and each test decides what GitHub, the AI, and the search
 * "answer". That lets us test things we cannot make happen on demand with
 * the real services, such as the search failing or a user hitting the daily
 * limit. It costs nothing.
 */
import { describe, expect, it } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { newBrief, type Brief } from '../schemas/briefs-schema'
import { DAILY_LIMIT, type Usage } from '../schemas/usage-schema'
import { NOTHING_TO_READ } from './ai'
import { PICK_PROMPT } from './competitors'
import { actions } from './index'
import { LIMIT_MESSAGE, today } from './usage'

const OWNER = 'user-1'
const BRIEF_ID = 'brief-1'

/** An AI answer in the real shape: the working-out part first, then the text. */
function aiSays(text: string) {
  return { success: true, data: { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] } }
}

// Pretend answers from the outside services.
const REPO_OK = {
  success: true,
  data: { description: 'Web framework', stargazers_count: 123, language: 'TypeScript', homepage: '', topics: [] },
}
const README_OK = { success: true, data: { content: btoa('# Hello') } }
const NOT_FOUND = { success: false, error: 'GitHub public API error 404: Not Found' }
const AI_OK = aiSays('{"summary": "It is a framework.", "audience": "Developers."}')
const AI_DOWN = { success: false, error: 'anthropic/chat-completion (500): upstream error' }
const SEARCH_OK = {
  success: true,
  data: {
    results: [
      { title: 'Hono vs Express', url: 'https://example.com/hono-vs-express', text: 'Express is another web framework.' },
    ],
  },
}
const SEARCH_DOWN = { success: false, error: 'exa/search (500): upstream error' }
// The AI lists one competitor that is on the page and one that is not.
const PICK_OK = aiSays(
  JSON.stringify({
    competitors: [
      { name: 'Express', description: 'A web framework.', source: 1 },
      { name: 'MadeUpCo', description: 'Not named on any page.', source: 1 },
    ],
  }),
)
const EXPRESS = { name: 'Express', description: 'A web framework.', url: 'https://example.com/hono-vs-express' }

const GITHUB_CALLS = ['github/get-repository', 'github/get-repository-readme']
const AI_CALL = 'anthropic/chat-completion'
const SEARCH_CALL = 'exa/search'

type Answers = { repo?: unknown; readme?: unknown; ai?: unknown; search?: unknown; pick?: unknown }

function setup(answers: Answers = {}) {
  const briefs = new Map<string, { createdBy: string; data: Brief }>()
  briefs.set(BRIEF_ID, {
    createdBy: OWNER,
    data: newBrief('https://github.com/honojs/hono', 'honojs', 'hono'),
  })
  const usage: Usage[] = []
  const calls: string[] = [] // every integration call, in order

  const fake = {
    get: async (_collection: string, id: string) => {
      const record = briefs.get(id)
      if (!record) return { success: false, error: 'not found' }
      return { success: true, data: { record: { recordId: id, ...record } } }
    },
    update: async (_collection: string, id: string, data: Partial<Brief>) => {
      const record = briefs.get(id)!
      record.data = { ...record.data, ...data }
      return { success: true, data: { recordId: id } }
    },
    query: async (_collection: string, options: { where: Usage }) => {
      const records = usage.filter(
        (row) => row.userId === options.where.userId && row.day === options.where.day,
      )
      return { success: true, data: { records, count: records.length } }
    },
    create: async (_collection: string, data: Usage) => {
      usage.push(data)
      return { success: true, data: { recordId: `usage-${usage.length}` } }
    },
    integration: async (endpoint: string, body: { system?: string }) => {
      calls.push(endpoint)
      if (endpoint === 'github/get-repository') return answers.repo ?? REPO_OK
      if (endpoint === 'github/get-repository-readme') return answers.readme ?? README_OK
      if (endpoint === SEARCH_CALL) return answers.search ?? SEARCH_OK
      // The AI is called twice. The standing instructions tell the calls apart.
      if (body.system === PICK_PROMPT) return answers.pick ?? PICK_OK
      return answers.ai ?? AI_OK
    },
  }

  const run = (userId = OWNER) =>
    actions.generateBrief({
      userId,
      params: { briefId: BRIEF_ID },
      tools: fake as unknown as ActionTools,
    } as never)

  return { run, answers, usage, calls, brief: () => briefs.get(BRIEF_ID)!.data }
}

describe('generateBrief', () => {
  it('runs GitHub, the AI, and the search, and saves all three', async () => {
    const test = setup()
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.calls).toEqual([...GITHUB_CALLS, AI_CALL, SEARCH_CALL, AI_CALL])
    expect(test.brief()).toMatchObject({
      status: 'done',
      error: '',
      stars: 123,
      readme: '# Hello',
      summary: 'It is a framework.',
      audience: 'Developers.',
    })
    // MadeUpCo is not named on the page it points to, so it was dropped.
    expect(test.brief().competitors).toEqual([EXPRESS])
    expect(test.usage).toHaveLength(1)
  })

  it('keeps the GitHub facts when the AI fails, and a retry does not ask GitHub again', async () => {
    const test = setup({ ai: AI_DOWN })
    const first = await test.run()

    expect(first.success).toBe(false)
    expect(test.brief().status).toBe('repo_loaded')
    expect(test.brief().stars).toBe(123)
    expect(test.brief().error).toContain('The AI summary could not be written')

    // The AI comes back. Run the same brief again.
    test.answers.ai = AI_OK
    test.calls.length = 0
    const second = await test.run()

    expect(second.success).toBe(true)
    expect(test.calls).toEqual([AI_CALL, SEARCH_CALL, AI_CALL])
    expect(test.brief()).toMatchObject({ status: 'done', error: '', summary: 'It is a framework.' })
  })

  it('keeps the summary when the search fails, and a retry only runs the search step', async () => {
    const test = setup({ search: SEARCH_DOWN })
    const first = await test.run()

    expect(first.success).toBe(false)
    expect(test.brief().status).toBe('summarized')
    expect(test.brief().summary).toBe('It is a framework.')
    expect(test.brief().competitors).toEqual([])
    expect(test.brief().error).toContain('The web search did not work')

    // The search comes back. Run the same brief again.
    test.answers.search = SEARCH_OK
    test.calls.length = 0
    const second = await test.run()

    expect(second.success).toBe(true)
    expect(test.calls).toEqual([SEARCH_CALL, AI_CALL])
    expect(test.brief()).toMatchObject({ status: 'done', error: '', competitors: [EXPRESS] })
  })

  it('finishes with an empty list when the search finds nothing, without asking the AI', async () => {
    const test = setup({ search: { success: true, data: { results: [] } } })
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.calls).toEqual([...GITHUB_CALLS, AI_CALL, SEARCH_CALL])
    expect(test.brief()).toMatchObject({ status: 'done', error: '', competitors: [] })
  })

  it('finishes with an empty list when every name the AI gives is made up', async () => {
    const madeUp = JSON.stringify({ competitors: [{ name: 'MadeUpCo', description: 'Invented.', source: 1 }] })
    const test = setup({ pick: aiSays(madeUp) })
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.brief()).toMatchObject({ status: 'done', competitors: [] })
  })

  it('does not count a repository GitHub cannot find', async () => {
    const test = setup({ repo: NOT_FOUND })
    const result = await test.run()

    expect(result.success).toBe(false)
    expect(test.brief().status).toBe('draft')
    expect(test.brief().error).toContain('could not find that repository')
    expect(test.calls).toEqual(['github/get-repository'])
    expect(test.usage).toHaveLength(0)
  })

  it("refuses to touch another user's brief", async () => {
    const test = setup()
    const result = await test.run('someone-else')

    expect(result).toEqual({ success: false, error: 'Brief not found.' })
    expect(test.calls).toEqual([])
    expect(test.brief().status).toBe('draft')
  })

  it('stops at the daily limit before making any paid call', async () => {
    const test = setup()
    for (let i = 0; i < DAILY_LIMIT; i++) {
      test.usage.push({ userId: OWNER, day: today() })
    }
    const result = await test.run()

    expect(result).toEqual({ success: false, error: LIMIT_MESSAGE })
    expect(test.calls).toEqual([])
    expect(test.usage).toHaveLength(DAILY_LIMIT)
  })

  it("does not count other users' runs or yesterday's runs toward the limit", async () => {
    const test = setup()
    for (let i = 0; i < DAILY_LIMIT; i++) {
      test.usage.push({ userId: 'someone-else', day: today() })
      test.usage.push({ userId: OWNER, day: '2020-01-01' })
    }
    const result = await test.run()

    expect(result.success).toBe(true)
  })

  it('does nothing, and counts nothing, for a brief that is already finished', async () => {
    const test = setup()
    await test.run()
    test.calls.length = 0
    const again = await test.run()

    expect(again.success).toBe(true)
    expect(test.calls).toEqual([])
    expect(test.usage).toHaveLength(1)
  })

  it('skips the AI and the search, and says so, when there is no description and no README', async () => {
    const test = setup({
      repo: { success: true, data: { stargazers_count: 0 } },
      readme: NOT_FOUND,
    })
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.calls).toEqual(GITHUB_CALLS)
    expect(test.brief()).toMatchObject({ status: 'done', summary: NOTHING_TO_READ, competitors: [] })
  })

  it('saves a clear error when the AI answer cannot be read', async () => {
    const test = setup({ ai: aiSays('Sorry, no.') })
    const result = await test.run()

    expect(result.success).toBe(false)
    expect(test.brief().status).toBe('repo_loaded')
    expect(test.brief().error).toContain('could not read')
  })
})
