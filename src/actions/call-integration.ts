/**
 * One safe way to call a DeepSpace integration from the server.
 *
 * `tools.integration` already returns { success: false, error } when the
 * other service says no. This wrapper adds the two cases it does not cover:
 *   - the call takes too long (we stop waiting and report a timeout)
 *   - the call crashes before we get any answer (for example, no network)
 *
 * Either way the caller gets back the same shape, so each step only has to
 * check `result.success`.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'

/** The error text used when we gave up waiting. Steps check for this exact text. */
export const TIMED_OUT = 'timed out'

export async function callIntegration<T>(
  tools: ActionTools,
  endpoint: string,
  body: unknown,
  timeoutMs: number,
): Promise<ActionResult<T>> {
  let timerId: ReturnType<typeof setTimeout> | undefined
  const timer = new Promise<ActionResult<T>>((resolve) => {
    timerId = setTimeout(() => resolve({ success: false, error: TIMED_OUT }), timeoutMs)
  })

  try {
    // Promise.race returns whichever finishes first: the real call or the timer.
    return await Promise.race([tools.integration<T>(endpoint, body), timer])
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { success: false, error: `no answer from ${endpoint}: ${reason}` }
  } finally {
    clearTimeout(timerId)
  }
}
