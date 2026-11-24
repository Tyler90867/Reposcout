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
import { loadRepo } from './github'

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Fills in a saved brief, one step at a time. After each step the result is
   * saved, so a later failure never throws away what already worked.
   *
   * Steps so far:
   *   1. GitHub: read the repository facts and README
   * Still to come: the AI summary and the competitor search.
   */
  generateBrief: async ({ userId, params, tools }) => {
    const briefId = String(params.briefId ?? '')

    // Find the brief and make sure it belongs to the person calling.
    const found = await tools.get<Brief>('briefs', briefId)
    if (!found.success || found.data.record.createdBy !== userId) {
      return { success: false, error: 'Brief not found.' }
    }
    const brief = found.data.record.data

    // Check the link again on the server. Never trust what the browser saved.
    const parsed = parseGithubUrl(brief.repoUrl)
    if (!parsed.ok) {
      return { success: false, error: parsed.error }
    }

    // A new attempt starts with a clean slate for the error message.
    await tools.update<Brief>('briefs', briefId, { error: '' })

    // Step 1: GitHub.
    const loaded = await loadRepo(tools, parsed.owner, parsed.repo)
    if (!loaded.ok) {
      await tools.update<Brief>('briefs', briefId, { error: loaded.error })
      return { success: false, error: loaded.error }
    }
    await tools.update<Brief>('briefs', briefId, { ...loaded.facts, status: 'repo_loaded' })

    return { success: true, data: { status: 'repo_loaded' } }
  },
}
