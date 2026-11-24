/**
 * Server actions: code that runs on the server, never in the browser.
 *
 * The browser calls an action with POST /api/actions/<name>. DeepSpace checks
 * the caller's sign-in before the action runs and tells us who they are
 * (`userId`).
 *
 * Important: the `tools` an action gets skip the permission rules in
 * briefs-schema.ts. So the action must check for itself that the brief
 * belongs to the caller before touching it.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { parseGithubUrl } from '../lib/github-url'
import type { Brief } from '../schemas/briefs-schema'
import { writeSummary } from './ai'
import { findCompetitors } from './competitors'
import { loadRepo } from './github'
import { hasReachedLimit, LIMIT_MESSAGE, recordUse } from './usage'

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Fills in a saved brief, one step at a time. After each step the result is
   * saved, so a later failure never throws away what already worked. Running
   * it again picks up where the last run stopped.
   *
   * The steps:
   *   1. GitHub: read the repository facts and README
   *   2. AI: write what the product does and who it is for
   *   3. Search: find competitors on the web, each with a real source link
   */
  generateBrief: async ({ userId, params, tools }) => {
    const briefId = String(params.briefId ?? '')

    // Find the brief and make sure it belongs to the person calling.
    const found = await tools.get<Brief>('briefs', briefId)
    if (!found.success || found.data.record.createdBy !== userId) {
      return { success: false, error: 'Brief not found.' }
    }
    let brief = found.data.record.data

    // Check the link again on the server. Never trust what the browser saved.
    const parsed = parseGithubUrl(brief.repoUrl)
    if (!parsed.ok) {
      return { success: false, error: parsed.error }
    }

    // Already finished. There is nothing to do and nothing to pay for.
    if (brief.status === 'done') {
      return { success: true, data: { status: brief.status } }
    }

    // The daily limit. Checked before any paid call is made.
    if (await hasReachedLimit(tools, userId)) {
      return { success: false, error: LIMIT_MESSAGE }
    }

    // When a step fails: save the reason on the brief and stop.
    async function stop(error: string) {
      await tools.update<Brief>('briefs', briefId, { error })
      return { success: false as const, error }
    }

    // A new attempt starts with a clean slate for the error message.
    await tools.update<Brief>('briefs', briefId, { error: '' })

    // Step 1: GitHub. Skipped if an earlier run already did it.
    if (brief.status === 'draft') {
      const loaded = await loadRepo(tools, parsed.owner, parsed.repo)
      if (!loaded.ok) {
        return stop(loaded.error)
      }
      await tools.update<Brief>('briefs', briefId, { ...loaded.facts, status: 'repo_loaded' })
      brief = { ...brief, ...loaded.facts, status: 'repo_loaded' }
    }

    // The repository is real, so this run now counts toward today's limit.
    // (A link that GitHub cannot find costs us nothing, so it is not counted.)
    if (!(await recordUse(tools, userId))) {
      return stop('RepoScout could not check your daily limit. Please try again.')
    }

    // Step 2: AI summary. Skipped if an earlier run already did it.
    if (brief.status === 'repo_loaded') {
      const written = await writeSummary(tools, brief)
      if (!written.ok) {
        return stop(written.error)
      }
      const summaryFields = { summary: written.summary, audience: written.audience, status: 'summarized' }
      await tools.update<Brief>('briefs', briefId, summaryFields)
      brief = { ...brief, ...summaryFields }
    }

    // Step 3: competitor search. An empty list is a valid result: it means
    // the search worked but no competitor could be backed up by a source.
    const searched = await findCompetitors(tools, brief)
    if (!searched.ok) {
      return stop(searched.error)
    }
    await tools.update<Brief>('briefs', briefId, { competitors: searched.competitors, status: 'done' })

    return { success: true, data: { status: 'done' } }
  },
}
