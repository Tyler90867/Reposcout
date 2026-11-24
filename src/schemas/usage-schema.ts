/**
 * The "usage" collection: one small record each time a user runs a brief.
 *
 * It exists for one reason: the daily limit in src/actions/usage.ts. To see
 * how many runs a user has had today, the server counts their records here.
 *
 * Nobody can read or write this collection from the browser. Only the
 * server action can, so a user cannot erase their own count.
 */

import type { CollectionSchema } from 'deepspace/schema'

/** How many briefs one user can run per day. */
export const DAILY_LIMIT = 10

export type Usage = {
  userId: string
  /** The date of the run, for example "2026-11-24" (UTC time). */
  day: string
}

export const usageSchema: CollectionSchema = {
  name: 'usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'day', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
