/**
 * Signed-in tests for the briefs pages, using two test accounts (A and B).
 *
 * What this proves:
 *   - a bad link is rejected and nothing is saved
 *   - a good link saves a brief, and it is still there after a refresh
 *   - a brief can be reopened and deleted
 *   - user B cannot see user A's brief, in the list or by its direct address
 *
 * The repo names here are made up. Nothing is fetched from GitHub in this
 * test, so it costs no credits.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`.',
)

test('briefs: save, refresh, reopen, delete, and stay private between two users', async ({ users }) => {
  const [a, b] = await users(2)

  // A different name on every run, so old runs can never confuse this one.
  const stamp = Date.now()
  const nameA = `example-owner/repo-a-${stamp}`
  const nameB = `example-owner/repo-b-${stamp}`

  // ── User A opens the page ──────────────────────────────────────────────
  await a.page.goto('/briefs')
  await expect(a.page.getByRole('heading', { name: 'Your briefs' })).toBeVisible({ timeout: 15_000 })
  const inputA = a.page.getByLabel('GitHub repository link')
  const saveA = a.page.getByRole('button', { name: 'Save brief' })

  // ── A bad link shows an error and saves nothing ────────────────────────
  await inputA.fill('hello')
  await saveA.click()
  await expect(a.page.locator('#repo-url-error')).toContainText('Only github.com links work here')

  // ── A good link saves a placeholder brief ──────────────────────────────
  await inputA.fill(`https://github.com/${nameA}`)
  await saveA.click()
  const rowA = a.page.getByTestId('brief-row').filter({ hasText: nameA })
  await expect(rowA).toBeVisible({ timeout: 15_000 })
  await expect(rowA).toContainText('Not generated yet')
  await expect(a.page.locator('#repo-url-error')).toHaveCount(0)

  // ── It survives a refresh ──────────────────────────────────────────────
  await a.page.reload()
  await expect(rowA).toBeVisible({ timeout: 15_000 })

  // ── User B saves their own brief, and sees only their own ──────────────
  await b.page.goto('/briefs')
  await expect(b.page.getByRole('heading', { name: 'Your briefs' })).toBeVisible({ timeout: 15_000 })
  await b.page.getByLabel('GitHub repository link').fill(`https://github.com/${nameB}`)
  await b.page.getByRole('button', { name: 'Save brief' }).click()
  const rowB = b.page.getByTestId('brief-row').filter({ hasText: nameB })
  await expect(rowB).toBeVisible({ timeout: 15_000 })
  // B's list has loaded (B's own brief is showing), and A's brief is not in it.
  await expect(b.page.getByTestId('brief-row').filter({ hasText: nameA })).toHaveCount(0)
  // And A does not see B's brief.
  await expect(a.page.getByTestId('brief-row').filter({ hasText: nameB })).toHaveCount(0)

  // ── A reopens the brief ────────────────────────────────────────────────
  await rowA.getByRole('link', { name: nameA }).click()
  await expect(a.page).toHaveURL(/\/briefs\/.+/)
  const detailA = a.page.getByTestId('brief-detail')
  await expect(detailA).toContainText(nameA)
  await expect(detailA).toContainText('Not generated yet.')
  const briefPathA = new URL(a.page.url()).pathname

  // ── B opens A's brief by its direct address and is refused ─────────────
  await b.page.goto(briefPathA)
  await expect(b.page.getByTestId('brief-not-found')).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByTestId('brief-detail')).toHaveCount(0)

  // ── A deletes the brief from its own page ──────────────────────────────
  await detailA.getByRole('button', { name: 'Delete' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(a.page).toHaveURL(/\/briefs$/, { timeout: 15_000 })
  await expect(a.page.getByRole('heading', { name: 'Your briefs' })).toBeVisible()
  await expect(a.page.getByTestId('brief-row').filter({ hasText: nameA })).toHaveCount(0)

  // ── B deletes their brief from the list (this also cleans up) ──────────
  await b.page.goto('/briefs')
  await expect(rowB).toBeVisible({ timeout: 15_000 })
  await rowB.getByRole('button', { name: 'Delete' }).click()
  await b.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rowB).toHaveCount(0, { timeout: 15_000 })

  // ── After a refresh, A's deleted brief is still gone ───────────────────
  await a.page.reload()
  await expect(a.page.getByRole('heading', { name: 'Your briefs' })).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByTestId('brief-list')).not.toContainText('Loading your briefs')
  await expect(a.page.getByTestId('brief-row').filter({ hasText: nameA })).toHaveCount(0)
})
