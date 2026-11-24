/**
 * The competitors part of a brief.
 *
 * Each competitor shows a name, one sentence, and a "Source" link. The link
 * is the web page, found by the search, that names the competitor. It is not
 * the competitor's own website.
 *
 * Like everything else from outside, names and sentences are shown as plain
 * text, and a link is only shown if it is a normal web address.
 */

import { isWebLink } from '@/lib/safe-text'
import type { Brief } from '@/schemas/briefs-schema'

// A brief should have 3 to 5 competitors. With fewer, we say so.
const GOOD_NUMBER = 3

export function Competitors({ brief }: { brief: Brief }) {
  // The search step has not finished for this brief.
  if (brief.status !== 'done') {
    return <span className="text-muted-foreground">Not generated yet.</span>
  }

  const competitors = brief.competitors.filter((competitor) => isWebLink(competitor.url))

  if (competitors.length === 0) {
    return (
      <p data-testid="no-competitors" className="text-muted-foreground">
        RepoScout could not confirm any competitors for this repository from a web search. It
        does not make them up.
      </p>
    )
  }

  return (
    <div data-testid="competitors">
      <ul className="flex flex-col gap-4">
        {competitors.map((competitor) => (
          <li key={competitor.name} data-testid="competitor">
            <p className="font-medium">{competitor.name}</p>
            <p className="text-muted-foreground">{competitor.description}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              Source:{' '}
              <a
                href={competitor.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 underline-offset-4 hover:underline"
              >
                {competitor.url}
              </a>
            </p>
          </li>
        ))}
      </ul>

      {competitors.length < GOOD_NUMBER && (
        <p data-testid="few-competitors" className="mt-4 text-muted-foreground">
          Only {competitors.length} could be confirmed from the search results.
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Each name appears on the linked page, which a web search found. The one-line descriptions
        are AI-written from those pages and can contain mistakes. Open the source to check.
      </p>
    </div>
  )
}
