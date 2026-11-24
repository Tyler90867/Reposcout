/**
 * Generating a brief, tested against the real GitHub, AI, and web search
 * integrations.
 *
 * What this proves:
 *   - a real public repository loads, and its facts show on the brief
 *   - the AI writes a summary and an audience for it
 *   - the search step finishes, and every competitor shown has a real web link
 *   - HTML inside a real README is shown as plain text, not run
 *   - the whole brief is still there after a refresh
 *   - a repository that does not exist gives a clear error, and the saved
 *     link is kept so the user can retry or delete it
 *
 * Cost: two GitHub calls, two AI calls, and one web search for the real
 * repository (a little over one credit per run). The failed lookup is not
 * charged. The real repository also uses one of Tester A's 10 briefs for
 * the day.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(usableTestAccounts < 1, 'Needs 1 usable test account.')

test('generate: a real repo gets a full brief, a missing repo shows a clear error', async ({ users }) => {
  // Real services are called one after another, so allow more than the usual 30 seconds.
  test.setTimeout(180_000)
  const [a] = await users(1)
  const missing = `honojs/reposcout-missing-${Date.now()}`

  await a.page.goto('/briefs')
  await expect(a.page.getByRole('heading', { name: 'Your briefs' })).toBeVisible({ timeout: 15_000 })
  const input = a.page.getByLabel('GitHub repository link')
  const save = a.page.getByRole('button', { name: 'Save brief' })

  // ── A real public repository ───────────────────────────────────────────
  await input.fill('https://github.com/honojs/hono')
  // Clicking Save makes the browser call the server. We read the new brief's
  // id out of that call, so the test always looks at the brief it just made.
  const [call] = await Promise.all([
    a.page.waitForRequest('**/api/actions/generateBrief'),
    save.click(),
  ])
  const briefId = call.postDataJSON().briefId as string
  const realRow = a.page
    .getByTestId('brief-row')
    .filter({ has: a.page.locator(`a[href="/briefs/${briefId}"]`) })
  await expect(realRow).toContainText('Brief ready', { timeout: 120_000 })
  await expect(a.page.locator('#repo-url-error')).toHaveCount(0)

  await realRow.getByRole('link', { name: 'honojs/hono' }).click()
  const facts = a.page.getByTestId('repo-facts')
  await expect(facts).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByTestId('repo-stars')).toHaveText(/\d/)
  await expect(facts).toContainText('Show the README text we saved')
  await expect(a.page.getByTestId('brief-error')).toHaveCount(0)

  // hono's README starts with real HTML, including an <img> tag. It must
  // show up as plain text. If the app treated it as HTML, the page would
  // contain a real image element here.
  await facts.getByText('Show the README text we saved').click()
  await expect(facts.locator('pre')).toContainText('<img src=')
  await expect(facts.locator('img')).toHaveCount(0)

  // The AI step wrote real sentences. We cannot know the exact words, so we
  // check that both parts are there and are more than a few characters.
  const summary = a.page.getByTestId('brief-summary')
  const audience = a.page.getByTestId('brief-audience')
  await expect(summary).not.toContainText('Not generated yet')
  await expect(audience).not.toContainText('Not generated yet')
  expect((await summary.innerText()).length).toBeGreaterThan(40)
  expect((await audience.innerText()).length).toBeGreaterThan(20)
  // Nothing is left to do, so the "Generate brief" box is gone.
  await expect(a.page.getByRole('button', { name: 'Generate brief' })).toHaveCount(0)

  // The search step finished. A real search can come back strong or weak, so
  // the test accepts both honest outcomes: a list where every competitor has
  // a real web link, or the "could not confirm any" message.
  const competitors = a.page.getByTestId('competitor')
  const count = await competitors.count()
  expect(count).toBeLessThanOrEqual(5)
  if (count === 0) {
    await expect(a.page.getByTestId('no-competitors')).toBeVisible()
  } else {
    for (const link of await competitors.getByRole('link').all()) {
      expect(await link.getAttribute('href')).toMatch(/^https?:\/\//)
    }
  }
  console.log(`Competitors shown for honojs/hono: ${count}`)
  console.log((await competitors.allInnerTexts()).join('\n---\n'))

  // ── Still there after a refresh ────────────────────────────────────────
  await a.page.reload()
  await expect(a.page.getByTestId('repo-facts')).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByTestId('brief-summary')).not.toContainText('Not generated yet')
  await expect(a.page.getByTestId('competitor')).toHaveCount(count)

  // Clean up the real one.
  await a.page.getByTestId('brief-detail').getByRole('button', { name: 'Delete' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(a.page).toHaveURL(/\/briefs$/, { timeout: 15_000 })

  // ── A repository that does not exist ───────────────────────────────────
  await input.fill(`https://github.com/${missing}`)
  await save.click()
  await expect(a.page.locator('#repo-url-error')).toContainText('could not find that repository', {
    timeout: 60_000,
  })
  const missingRow = a.page.getByTestId('brief-row').filter({ hasText: missing })
  await expect(missingRow).toContainText('Could not load from GitHub')

  await missingRow.getByRole('link', { name: missing }).click()
  await expect(a.page.getByTestId('brief-error')).toContainText('could not find that repository')
  await expect(a.page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(a.page.getByTestId('repo-facts')).toHaveCount(0)

  // Clean up the missing one.
  await a.page.getByTestId('brief-detail').getByRole('button', { name: 'Delete' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(a.page).toHaveURL(/\/briefs$/, { timeout: 15_000 })
  await expect(a.page.getByTestId('brief-row').filter({ hasText: missing })).toHaveCount(0)
})

/**
 * Server actions skip the normal permission rules, so the action has to
 * check ownership itself. This proves that check works.
 * Cost: nothing. Both lookups are for repositories that do not exist, and
 * those are not charged and do not count toward the daily limit.
 */
test('generate: nobody can run it on a brief they do not own', async ({ users }) => {
  test.skip(usableTestAccounts < 2, 'Needs 2 usable test accounts.')
  const [a, b] = await users(2)
  const stamp = Date.now()
  const nameA = `honojs/reposcout-missing-a-${stamp}`
  const nameB = `honojs/reposcout-missing-b-${stamp}`

  // User A saves a brief. Open it to read its id from the address bar.
  await a.page.goto('/briefs')
  await a.page.getByLabel('GitHub repository link').fill(`https://github.com/${nameA}`)
  await a.page.getByRole('button', { name: 'Save brief' }).click()
  const rowA = a.page.getByTestId('brief-row').filter({ hasText: nameA })
  await expect(rowA).toContainText('Could not load from GitHub', { timeout: 60_000 })
  await rowA.getByRole('link', { name: nameA }).click()
  await expect(a.page).toHaveURL(/\/briefs\/.+/)
  const briefIdA = new URL(a.page.url()).pathname.split('/').pop()

  // User B saves their own brief. We copy the sign-in proof B's browser sends.
  await b.page.goto('/briefs')
  await b.page.getByLabel('GitHub repository link').fill(`https://github.com/${nameB}`)
  const [requestB] = await Promise.all([
    b.page.waitForRequest('**/api/actions/generateBrief'),
    b.page.getByRole('button', { name: 'Save brief' }).click(),
  ])
  const signInProofB = requestB.headers()['authorization']
  // Wait for B's own call to finish. Its result does not matter here (B may
  // even be at the daily limit). We only needed B's sign-in proof.
  await requestB.response()
  const rowB = b.page.getByTestId('brief-row').filter({ hasText: nameB })
  await expect(rowB).toBeVisible({ timeout: 15_000 })

  // B asks the server to work on A's brief. The server must refuse.
  const asB = await b.page.request.post('/api/actions/generateBrief', {
    headers: { Authorization: signInProofB },
    data: { briefId: briefIdA },
  })
  expect(await asB.json()).toEqual({ success: false, error: 'Brief not found.' })

  // Nobody signed in at all: refused before the action even runs.
  const signedOut = await b.page.request.post('/api/actions/generateBrief', {
    headers: { Authorization: '' },
    data: { briefId: briefIdA },
  })
  expect(signedOut.status()).toBe(401)

  // Clean up both briefs.
  await a.page.getByTestId('brief-detail').getByRole('button', { name: 'Delete' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(a.page).toHaveURL(/\/briefs$/, { timeout: 15_000 })
  await rowB.getByRole('button', { name: 'Delete' }).click()
  await b.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(rowB).toHaveCount(0, { timeout: 15_000 })
})
