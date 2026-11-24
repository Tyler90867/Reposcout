/**
 * The daily limit: each user can run a set number of briefs per day.
 *
 * Why: the app owner pays for every GitHub and AI call. Without a limit,
 * one signed-in user could click in a loop and run up the bill.
 *
 * How: every counted run adds one record { userId, day } to the "usage"
 * collection. To check the limit we count that user's records for today.
 */

import type { ActionTools } from 'deepspace/worker'
import { DAILY_LIMIT, type Usage } from '../schemas/usage-schema'

export const LIMIT_MESSAGE = `You have reached today's limit of ${DAILY_LIMIT} briefs. The limit resets at midnight UTC.`

/** Today's date as text, for example "2026-11-24" (UTC time). */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** True when this user has already used up today's runs. */
export async function hasReachedLimit(tools: ActionTools, userId: string): Promise<boolean> {
  const used = await tools.query<Usage>('usage', {
    where: { userId, day: today() },
    limit: DAILY_LIMIT,
  })
  // If the count cannot be read, stay on the safe side and say "yes".
  if (!used.success) return true
  return used.data.records.length >= DAILY_LIMIT
}

/** Writes down one run for this user. Returns false if it could not be saved. */
export async function recordUse(tools: ActionTools, userId: string): Promise<boolean> {
  const saved = await tools.create<Usage>('usage', { userId, day: today() })
  return saved.success
}
