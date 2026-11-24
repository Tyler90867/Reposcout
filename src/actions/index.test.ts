/**
 * Tests for the whole generateBrief flow, with nothing real behind it.
 *
 * "Fake tools" stand in for DeepSpace: briefs live in a Map, usage records in
 * an array, and each test decides what GitHub and the AI "answer". That lets
 * us test things we cannot make happen on demand with the real services,
 * such as the AI failing or a user hitting the daily limit. It costs nothing.
 */
import { describe, expect, it } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { newBrief, type Brief } from '../schemas/briefs-schema'
import { DAILY_LIMIT, type Usage } from '../schemas/usage-schema'
import { NOTHING_TO_READ } from './ai'
import { actions } from './index'
import { LIMIT_MESSAGE, today } from './usage'

const OWNER = 'user-1'
const BRIEF_ID = 'brief-1'

// Pretend answers from the outside services.
const REPO_OK = {
  success: true,
  data: { description: 'Web framework', stargazers_count: 123, language: 'TypeScript', homepage: '', topics: [] },
}
const README_OK = { success: true, data: { content: btoa('# Hello') } }
const NOT_FOUND = { success: false, error: 'GitHub public API error 404: Not Found' }
const AI_OK = {
  success: true,
  data: { content: [{ type: 'text', text: '{"summary": "It is a framework.", "audience": "Developers."}' }] },
}
const AI_DOWN = { success: false, error: 'anthropic/chat-completion (500): upstream error' }

type Answers = { repo?: unknown; readme?: unknown; ai?: unknown }

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
    integration: async (endpoint: string) => {
      calls.push(endpoint)
      if (endpoint === 'github/get-repository') return answers.repo ?? REPO_OK
      if (endpoint === 'github/get-repository-readme') return answers.readme ?? README_OK
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
  it('runs GitHub, then the AI, and saves both', async () => {
    const test = setup()
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.calls).toEqual([
      'github/get-repository',
      'github/get-repository-readme',
      'anthropic/chat-completion',
    ])
    expect(test.brief()).toMatchObject({
      status: 'summarized',
      error: '',
      stars: 123,
      readme: '# Hello',
      summary: 'It is a framework.',
      audience: 'Developers.',
    })
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
    expect(test.calls).toEqual(['anthropic/chat-completion'])
    expect(test.brief()).toMatchObject({ status: 'summarized', error: '', summary: 'It is a framework.' })
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

  it('skips the AI and says so when there is no description and no README', async () => {
    const test = setup({
      repo: { success: true, data: { stargazers_count: 0 } },
      readme: NOT_FOUND,
    })
    const result = await test.run()

    expect(result.success).toBe(true)
    expect(test.calls).not.toContain('anthropic/chat-completion')
    expect(test.brief().summary).toBe(NOTHING_TO_READ)
  })

  it('saves a clear error when the AI answer cannot be read', async () => {
    const test = setup({ ai: { success: true, data: { content: [{ type: 'text', text: 'Sorry, no.' }] } } })
    const result = await test.run()

    expect(result.success).toBe(false)
    expect(test.brief().status).toBe('repo_loaded')
    expect(test.brief().error).toContain('could not read')
  })
})
