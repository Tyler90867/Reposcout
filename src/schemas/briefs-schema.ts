/**
 * The "briefs" collection: one record per launch brief a user saves.
 *
 * A schema tells DeepSpace two things:
 *   1. columns: what fields a brief has
 *   2. permissions: who is allowed to read / create / update / delete briefs
 *
 * DeepSpace enforces the permissions on the server, so the browser cannot
 * get around them.
 */

import type { CollectionSchema } from 'deepspace/schema'

/** One competitor inside a brief. Every competitor must have a real source link. */
export type Competitor = {
  name: string
  description: string
  url: string
}

/** The shape of one brief, as the pages read and write it. */
export type Brief = {
  repoUrl: string
  owner: string
  repo: string
  /** 'draft' = saved, but nothing has been generated for it yet. */
  status: string
  summary: string
  audience: string
  competitors: Competitor[]
}

export const briefsSchema: CollectionSchema = {
  name: 'briefs',
  columns: [
    { name: 'repoUrl', storage: 'text', interpretation: 'plain', required: true },
    { name: 'owner', storage: 'text', interpretation: 'plain', required: true },
    { name: 'repo', storage: 'text', interpretation: 'plain', required: true },
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'draft' },
    { name: 'summary', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'audience', storage: 'text', interpretation: 'plain', default: '' },
    // A list of competitors, stored as JSON. DeepSpace converts it for us.
    { name: 'competitors', storage: 'text', interpretation: { kind: 'json' }, default: [] },
  ],
  permissions: {
    // viewer = someone who is not signed in. They get nothing.
    viewer: { read: false, create: false, update: false, delete: false },
    // member = any signed-in user. 'own' means "only records I created".
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    // admin = the app owner. Same rules, so the owner cannot read other people's briefs.
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}
