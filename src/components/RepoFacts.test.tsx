/**
 * Proves that hostile text from GitHub is shown as text and never run.
 *
 * renderToStaticMarkup gives us the exact HTML the component produces, so we
 * can look for real tags in it.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { newBrief, type Brief } from '@/schemas/briefs-schema'
import { RepoFacts } from './RepoFacts'

const hostileBrief: Brief = {
  ...newBrief('https://github.com/someone/bad-repo', 'someone', 'bad-repo'),
  status: 'repo_loaded',
  description: '<img src=x onerror="alert(1)">',
  readme: '<script>alert("hacked")</script>',
  topics: ['<iframe src="https://evil.example"></iframe>'],
  homepage: 'javascript:alert(1)',
}

describe('RepoFacts with hostile content', () => {
  const html = renderToStaticMarkup(<RepoFacts brief={hostileBrief} />)

  it('shows HTML from GitHub as plain text, never as real tags', () => {
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<iframe')
    // The text is still there for the user to read, with < and > made harmless.
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not turn a "javascript:" address into a link', () => {
    expect(html).not.toContain('<a ')
    expect(html).toContain('None listed')
  })

  it('still links a normal website', () => {
    const normal = renderToStaticMarkup(
      <RepoFacts brief={{ ...hostileBrief, homepage: 'https://hono.dev' }} />,
    )
    expect(normal).toContain('href="https://hono.dev"')
  })
})
