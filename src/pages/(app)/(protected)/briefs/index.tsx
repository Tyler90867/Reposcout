/**
 * The main page: /briefs
 *
 * Top half: a form to paste a GitHub repo link. Saving it also asks the
 * server to fill in the brief (GitHub, AI summary, competitor search).
 * Bottom half: the list of briefs this user has saved.
 *
 * This file lives in the (protected) folder, so only signed-in users reach it.
 */

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { Button, ConfirmModal, Input, Label, useToast } from '@/components/ui'
import { generateBrief } from '@/lib/generate-brief'
import { parseGithubUrl } from '@/lib/github-url'
import { newBrief, type Brief } from '@/schemas/briefs-schema'
import { DAILY_LIMIT } from '@/schemas/usage-schema'

export default function BriefsPage() {
  // useQuery keeps a live list of briefs. The server only sends briefs that
  // belong to the signed-in user (see the permissions in briefs-schema.ts).
  const { records: briefs, status, error: loadError } = useQuery<Brief>('briefs', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  // useMutations gives us functions that change data. The "Confirmed" versions
  // wait until the server says the change was really saved.
  const { ready, createConfirmed, removeConfirmed } = useMutations<Brief>('briefs')
  const toast = useToast()

  const [repoUrl, setRepoUrl] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Which brief the "are you sure?" box is asking about (null = box is closed).
  const [briefToDelete, setBriefToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(event: FormEvent) {
    event.preventDefault() // stop the browser from reloading the page

    const parsed = parseGithubUrl(repoUrl)
    if (!parsed.ok) {
      setFormError(parsed.error)
      return
    }

    setFormError('')
    setSaving(true)
    try {
      // 1. Save the link as a new brief. We get back the new brief's id.
      const briefId = await createConfirmed(newBrief(parsed.url, parsed.owner, parsed.repo))
      setRepoUrl('')

      // 2. Ask the server to fill it in (GitHub, AI summary, competitor search).
      const result = await generateBrief(briefId)
      if (result.ok) {
        toast.success('Brief ready', `${parsed.owner}/${parsed.repo}`)
      } else {
        setFormError(`${result.error} The link is still saved below, so you can retry or delete it.`)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setFormError(`Could not save the brief: ${reason}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!briefToDelete) return
    setDeleting(true)
    try {
      await removeConfirmed(briefToDelete.id)
      toast.success('Brief deleted', briefToDelete.name)
      setBriefToDelete(null)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      toast.error('Could not delete the brief', reason)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Your briefs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a public GitHub repository link to save a brief for it.
        </p>

        <form
          onSubmit={handleSave}
          className="mt-6 rounded-lg border border-border bg-card p-6"
          data-testid="brief-form"
        >
          <Label htmlFor="repo-url">GitHub repository link</Label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="repo-url"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              autoComplete="off"
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? 'repo-url-error' : undefined}
            />
            <Button type="submit" disabled={!ready} loading={saving} className="shrink-0">
              Save brief
            </Button>
          </div>
          {formError && (
            <p id="repo-url-error" role="alert" className="mt-3 text-sm text-destructive">
              {formError}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {saving
              ? 'Reading the repository, writing the summary, and searching for competitors. This can take up to a minute...'
              : `RepoScout reads the repository from GitHub, writes an AI summary, and searches the web for competitors. Limit: ${DAILY_LIMIT} briefs per day.`}
          </p>
        </form>

        <h2 className="mt-10 text-sm font-medium text-muted-foreground">Saved briefs</h2>

        <div className="mt-3" data-testid="brief-list">
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground">Loading your briefs...</p>
          )}

          {status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              Could not load your briefs: {loadError}
            </p>
          )}

          {status === 'ready' && briefs.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No briefs yet. Paste a repository link above to save your first one.
            </p>
          )}

          {status === 'ready' && briefs.length > 0 && (
            <ul className="flex flex-col gap-3">
              {briefs.map((brief) => {
                const name = `${brief.data.owner}/${brief.data.repo}`
                return (
                  <li
                    key={brief.recordId}
                    data-testid="brief-row"
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/briefs/${brief.recordId}`}
                        className="block truncate font-medium text-foreground underline-offset-4 hover:text-blue-400 hover:underline"
                      >
                        {name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saved {new Date(brief.createdAt).toLocaleDateString()}
                        {' · '}
                        {statusLabel(brief.data)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!ready}
                      onClick={() => setBriefToDelete({ id: brief.recordId, name })}
                    >
                      Delete
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        open={briefToDelete !== null}
        onClose={() => setBriefToDelete(null)}
        onConfirm={handleDelete}
        title="Delete this brief?"
        description={`${briefToDelete?.name ?? ''} will be removed for good.`}
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  )
}

/** The few words shown under each brief in the list. */
function statusLabel(brief: Brief): string {
  if (brief.status === 'done') return 'Brief ready'
  if (brief.status === 'summarized') {
    return brief.error ? 'Could not find competitors' : 'Summary written, competitors not searched yet'
  }
  if (brief.status === 'repo_loaded') {
    return brief.error ? 'Could not write the summary' : 'Repository loaded, summary not written yet'
  }
  return brief.error ? 'Could not load from GitHub' : 'Not generated yet'
}
