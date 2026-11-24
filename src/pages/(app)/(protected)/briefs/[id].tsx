/**
 * One brief: /briefs/<id>
 *
 * The square brackets in the file name mean "this part of the URL is a
 * variable". Opening /briefs/abc123 shows the brief whose id is abc123.
 */

import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { RepoFacts } from '@/components/RepoFacts'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { generateBrief } from '@/lib/generate-brief'
import type { Brief } from '@/schemas/briefs-schema'

export default function BriefDetailPage() {
  const { id } = useParams() // the <id> part of the URL
  const navigate = useNavigate()
  const toast = useToast()

  // Same query as the list page. The server only sends this user's briefs,
  // so somebody else's brief id simply will not be found here.
  const { records: briefs, status, error: loadError } = useQuery<Brief>('briefs', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { ready, removeConfirmed } = useMutations<Brief>('briefs')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // True while we wait for the server to work on the brief.
  const [running, setRunning] = useState(false)

  const brief = briefs.find((record) => record.recordId === id)

  async function handleGenerate() {
    if (!brief) return
    setRunning(true)
    const result = await generateBrief(brief.recordId)
    if (!result.ok) {
      toast.error('Could not finish the brief', result.error)
    }
    // No need to copy the result into this page by hand: the server saved it
    // on the brief, and useQuery above shows the new data by itself.
    setRunning(false)
  }

  async function handleDelete() {
    if (!brief) return
    setDeleting(true)
    try {
      await removeConfirmed(brief.recordId)
      toast.success('Brief deleted', `${brief.data.owner}/${brief.data.repo}`)
      navigate('/briefs')
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      toast.error('Could not delete the brief', reason)
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/briefs"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to your briefs
        </Link>

        {status === 'loading' && (
          <p className="mt-6 text-sm text-muted-foreground">Loading brief...</p>
        )}

        {status === 'error' && (
          <p role="alert" className="mt-6 text-sm text-destructive">
            Could not load this brief: {loadError}
          </p>
        )}

        {status === 'ready' && !brief && !deleting && (
          <div
            className="mt-6 rounded-lg border border-border bg-card p-6"
            data-testid="brief-not-found"
          >
            <h1 className="text-lg font-semibold">Brief not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This brief does not exist, was deleted, or belongs to another account.
            </p>
          </div>
        )}

        {brief && (
          <div data-testid="brief-detail">
            <div className="mt-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">
                  {brief.data.owner}/{brief.data.repo}
                </h1>
                <a
                  href={brief.data.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-sm text-blue-400 underline-offset-4 hover:underline"
                >
                  {brief.data.repoUrl}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved {new Date(brief.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!ready}
                onClick={() => setConfirmOpen(true)}
                className="shrink-0"
              >
                Delete
              </Button>
            </div>

            {brief.data.error && (
              <p
                role="alert"
                data-testid="brief-error"
                className="mt-6 rounded-lg border border-destructive bg-card p-4 text-sm text-destructive"
              >
                {brief.data.error}
              </p>
            )}

            {/* Shown until every step built so far has finished. */}
            {brief.data.status !== 'summarized' && (
              <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {running ? 'Working on it. This can take up to a minute...' : unfinishedText(brief.data)}
                </p>
                <Button size="sm" loading={running} onClick={handleGenerate} className="shrink-0">
                  {brief.data.error ? 'Try again' : 'Generate brief'}
                </Button>
              </div>
            )}

            {brief.data.status !== 'draft' && (
              <Section title="From GitHub">
                <RepoFacts brief={brief.data} />
              </Section>
            )}

            <Section title="What it does">
              <span data-testid="brief-summary">{brief.data.summary || <NotGenerated />}</span>
            </Section>

            <Section title="Who it is for">
              <span data-testid="brief-audience">{brief.data.audience || <NotGenerated />}</span>
            </Section>

            {brief.data.summary && (
              <p className="mt-3 text-xs text-muted-foreground">
                These two sections are based only on the repository's description and README.
                AI-written text can contain mistakes.
              </p>
            )}

            <Section title="Competitors">
              {brief.data.competitors.length === 0 ? (
                <NotGenerated />
              ) : (
                <ul className="flex flex-col gap-3">
                  {brief.data.competitors.map((competitor) => (
                    <li key={competitor.url}>
                      <a
                        href={competitor.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-400 underline-offset-4 hover:underline"
                      >
                        {competitor.name}
                      </a>
                      <p className="text-muted-foreground">{competitor.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this brief?"
        description="It will be removed for good."
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  )
}

/** A titled card, used for each part of the brief. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

/** What to tell the user about a brief that is not finished yet. */
function unfinishedText(brief: Brief): string {
  if (brief.status === 'draft') return 'The link is saved, but nothing has been loaded for it yet.'
  return 'The repository is loaded, but the summary is not written yet.'
}

function NotGenerated() {
  return <span className="text-muted-foreground">Not generated yet.</span>
}
