/**
 * The real facts the GitHub step saved on a brief.
 *
 * Everything here came from GitHub, so anyone could have written it. It is
 * always shown as plain text inside { }. React turns characters like < and >
 * into harmless text, so HTML or scripts in a README cannot run.
 */

import { isWebLink } from '@/lib/safe-text'
import type { Brief } from '@/schemas/briefs-schema'

export function RepoFacts({ brief }: { brief: Brief }) {
  return (
    <div data-testid="repo-facts">
      <p>{brief.description || <span className="text-muted-foreground">No description on GitHub.</span>}</p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
        <dt>Stars</dt>
        <dd data-testid="repo-stars" className="text-foreground">
          {brief.stars.toLocaleString()}
        </dd>

        <dt>Main language</dt>
        <dd className="text-foreground">{brief.language || 'Not listed'}</dd>

        <dt>Website</dt>
        <dd className="break-all text-foreground">
          {/* Only turn the website into a link if it is a normal web address. */}
          {isWebLink(brief.homepage) ? (
            <a
              href={brief.homepage}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline-offset-4 hover:underline"
            >
              {brief.homepage}
            </a>
          ) : (
            'None listed'
          )}
        </dd>

        <dt>Topics</dt>
        <dd className="text-foreground">{brief.topics.length > 0 ? brief.topics.join(', ') : 'None'}</dd>
      </dl>

      {brief.readme ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Show the README text we saved ({brief.readme.length.toLocaleString()} characters)
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary p-3 text-xs">
            {brief.readme}
          </pre>
        </details>
      ) : (
        <p className="mt-4 text-muted-foreground">This repository has no README.</p>
      )}
    </div>
  )
}
