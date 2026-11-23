/**
 * Turns whatever the user pasted into a clean GitHub owner + repo name,
 * or a plain-English error message if it is not a GitHub repo link.
 *
 * Example: "https://github.com/facebook/react/tree/main"
 *       -> { ok: true, owner: "facebook", repo: "react", url: "https://github.com/facebook/react" }
 */

export type ParsedRepoUrl =
  | { ok: true; owner: string; repo: string; url: string }
  | { ok: false; error: string }

const EXAMPLE = 'https://github.com/owner/repo'

export function parseGithubUrl(input: string): ParsedRepoUrl {
  const text = input.trim()
  if (!text) {
    return { ok: false, error: 'Paste a GitHub repository link first.' }
  }

  // Let people skip the "https://" part.
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return { ok: false, error: `That does not look like a link. It should look like ${EXAMPLE}` }
  }

  const host = url.hostname.toLowerCase()
  if (host !== 'github.com' && host !== 'www.github.com') {
    return { ok: false, error: `Only github.com links work here. It should look like ${EXAMPLE}` }
  }

  // "/facebook/react/tree/main" -> ["facebook", "react", "tree", "main"]
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) {
    return { ok: false, error: `That link is missing the repository name. It should look like ${EXAMPLE}` }
  }

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')

  // GitHub only allows these characters in owner and repo names.
  const ownerLooksValid = /^[A-Za-z0-9-]{1,39}$/.test(owner)
  const repoLooksValid = /^[A-Za-z0-9._-]{1,100}$/.test(repo)
  if (!ownerLooksValid || !repoLooksValid) {
    return { ok: false, error: `That is not a valid GitHub repository link. It should look like ${EXAMPLE}` }
  }

  return { ok: true, owner, repo, url: `https://github.com/${owner}/${repo}` }
}
