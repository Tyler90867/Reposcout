/**
 * Asks the server to fill in a saved brief.
 *
 * The real work happens in src/actions/index.ts, on the server. This file is
 * only the browser's side of the call: send the brief id, wait, and report
 * back whether it worked.
 */

import { getAuthToken } from 'deepspace'

export type GenerateResult = { ok: true } | { ok: false; error: string }

export async function generateBrief(briefId: string): Promise<GenerateResult> {
  try {
    const response = await fetch('/api/actions/generateBrief', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Proves to the server who is asking.
        Authorization: `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({ briefId }),
    })
    const result = (await response.json()) as { success?: boolean; error?: string }
    if (result.success) return { ok: true }
    return { ok: false, error: result.error ?? 'The server could not finish the brief.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}
