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
  /**
   * How far the brief has got:
   *   'draft'       = saved, nothing loaded yet
   *   'repo_loaded' = the GitHub step finished
   *   'summarized'  = the AI step finished
   */
  status: string
  /** Why the last attempt stopped. Empty when nothing went wrong. */
  error: string

  // Filled in by the GitHub step (src/actions/github.ts).
  description: string
  stars: number
  language: string
  homepage: string
  topics: string[]
  readme: string

  // Filled in by the AI step (src/actions/ai.ts).
  summary: string
  audience: string

  // Not generated yet. This comes from the search step.
  competitors: Competitor[]
}

/** A brand new brief: just the link, with every other field empty. */
export function newBrief(repoUrl: string, owner: string, repo: string): Brief {
  return {
    repoUrl,
    owner,
    repo,
    status: 'draft',
    error: '',
    description: '',
    stars: 0,
    language: '',
    homepage: '',
    topics: [],
    readme: '',
    summary: '',
    audience: '',
    competitors: [],
  }
}

export const briefsSchema: CollectionSchema = {
  name: 'briefs',
  columns: [
    { name: 'repoUrl', storage: 'text', interpretation: 'plain', required: true },
    { name: 'owner', storage: 'text', interpretation: 'plain', required: true },
    { name: 'repo', storage: 'text', interpretation: 'plain', required: true },
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'draft' },
    { name: 'error', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'description', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'stars', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'language', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'homepage', storage: 'text', interpretation: 'plain', default: '' },
    // A list of topic words, stored as JSON. DeepSpace converts it for us.
    { name: 'topics', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'readme', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'summary', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'audience', storage: 'text', interpretation: 'plain', default: '' },
    // A list of competitors, stored as JSON.
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
