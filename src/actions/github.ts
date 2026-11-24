/**
 * Step 1 of making a brief: read the repository from GitHub.
 *
 * Two calls go through DeepSpace's GitHub integration:
 *   - github/get-repository         -> description, stars, language, topics
 *   - github/get-repository-readme  -> the README file
 *
 * DeepSpace holds the GitHub access. There is no key in this project.
 *
 * Safety: we only ever read text ABOUT the repository. The repository's code
 * is never downloaded and never run. And because anyone can write anything
 * in a repository, every field is cleaned before it is saved (toRepoFacts).
 */

import type { ActionTools } from 'deepspace/worker'
import { cleanText, isWebLink } from '../lib/safe-text'
import { callIntegration, TIMED_OUT } from './call-integration'

/** The facts we keep from GitHub. They are saved straight onto the brief. */
export type RepoFacts = {
  description: string
  stars: number
  language: string
  homepage: string
  topics: string[]
  readme: string
}

export type LoadRepoResult = { ok: true; facts: RepoFacts } | { ok: false; error: string }

// GitHub sends about 80 fields per repository. These are the ones we read.
// They are marked "unknown" on purpose: the data comes from outside, so we
// check each field ourselves instead of assuming it is what we expect.
export type GithubRepo = {
  description?: unknown
  stargazers_count?: unknown
  language?: unknown
  homepage?: unknown
  topics?: unknown
}

type GithubReadme = { content?: unknown }

const TIMEOUT_MS = 20_000

/** Long READMEs are cut here. It keeps the saved brief and the later AI call small. */
export const README_MAX_CHARS = 6000

export async function loadRepo(tools: ActionTools, owner: string, repo: string): Promise<LoadRepoResult> {
  const repoResult = await callIntegration<GithubRepo>(
    tools,
    'github/get-repository',
    { owner, repo },
    TIMEOUT_MS,
  )
  if (!repoResult.success) {
    return { ok: false, error: explainGithubError(repoResult.error) }
  }

  const readmeResult = await callIntegration<GithubReadme>(
    tools,
    'github/get-repository-readme',
    { owner, repo },
    TIMEOUT_MS,
  )

  let readme = ''
  if (readmeResult.success) {
    readme = decodeReadme(readmeResult.data?.content)
  } else if (!isNotFound(readmeResult.error)) {
    return { ok: false, error: explainGithubError(readmeResult.error) }
  }
  // "Not found" on the README call means the repository has no README.
  // That is allowed, so we carry on with an empty one.

  return { ok: true, facts: toRepoFacts(repoResult.data ?? {}, readme) }
}

/**
 * Picks the fields we keep and cleans each one: text only, no invisible
 * characters, and a maximum length. Nothing from GitHub is saved as is.
 */
export function toRepoFacts(data: GithubRepo, readme: string): RepoFacts {
  const stars = data.stargazers_count
  const homepage = cleanText(data.homepage, 300)
  const topics = Array.isArray(data.topics) ? data.topics : []

  return {
    description: cleanText(data.description, 500),
    stars: typeof stars === 'number' && Number.isFinite(stars) ? stars : 0,
    language: cleanText(data.language, 50),
    // Keep the website only if it is a normal web address.
    homepage: isWebLink(homepage) ? homepage : '',
    topics: topics
      .slice(0, 20)
      .map((topic) => cleanText(topic, 50))
      .filter((topic) => topic !== ''),
    readme,
  }
}

/**
 * GitHub sends the README in base64, a way of writing any file using only
 * letters and digits. This turns it back into normal text.
 */
export function decodeReadme(base64: unknown): string {
  if (typeof base64 !== 'string') return ''
  try {
    const binary = atob(base64.replace(/\s/g, ''))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const text = new TextDecoder().decode(bytes)
    return cleanText(text, README_MAX_CHARS)
  } catch {
    // Not valid base64. Treat it as "no README" instead of crashing.
    return ''
  }
}

function isNotFound(error: string): boolean {
  return /\b404\b/.test(error)
}

/** Turns a raw integration error into a sentence a user can act on. */
export function explainGithubError(error: string): string {
  if (error === TIMED_OUT) {
    return 'GitHub took too long to answer. Please try again.'
  }
  if (isNotFound(error)) {
    return (
      'GitHub could not find that repository. Check the spelling of the link. ' +
      'If the repository is private, RepoScout cannot read it. Only public repositories work.'
    )
  }
  if (/\b(403|429)\b/.test(error) || /rate limit/i.test(error)) {
    return 'GitHub is limiting requests right now. Please try again in a few minutes.'
  }
  return `GitHub could not be read right now. Please try again. (Details: ${error})`
}
