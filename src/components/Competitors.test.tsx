/**
 * Proves the competitors list is honest and safe:
 *   - hostile text is shown as text and never run
 *   - a competitor without a normal web link is not shown
 *   - an empty or short list says so
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { newBrief, type Brief, type Competitor } from '@/schemas/briefs-schema'
import { Competitors } from './Competitors'

function briefWith(competitors: Competitor[], status = 'done'): Brief {
  return { ...newBrief('https://github.com/honojs/hono', 'honojs', 'hono'), status, competitors }
}

const express: Competitor = {
  name: 'Express',
  description: 'A web framework for Node.js.',
  url: 'https://example.com/hono-vs-express',
}

describe('Competitors', () => {
  it('shows the name, the sentence, and a source link', () => {
    const html = renderToStaticMarkup(<Competitors brief={briefWith([express])} />)
    expect(html).toContain('Express')
    expect(html).toContain('A web framework for Node.js.')
    expect(html).toContain('href="https://example.com/hono-vs-express"')
  })

  it('says "not generated yet" until the search step has finished', () => {
    const html = renderToStaticMarkup(<Competitors brief={briefWith([], 'summarized')} />)
    expect(html).toContain('Not generated yet.')
  })

  it('says so when a finished brief has no competitors', () => {
    const html = renderToStaticMarkup(<Competitors brief={briefWith([])} />)
    expect(html).toContain('could not confirm any competitors')
    expect(html).not.toContain('<a ')
  })

  it('says so when there are fewer than three', () => {
    const html = renderToStaticMarkup(<Competitors brief={briefWith([express])} />)
    expect(html).toContain('Only 1 could be confirmed')
  })

  it('shows hostile text as plain text and drops a "javascript:" link', () => {
    const hostile: Competitor[] = [
      { name: '<script>alert(1)</script>', description: '<img src=x onerror="alert(1)">', url: 'https://example.com/a' },
      { name: 'Bad link', description: 'Should not be shown.', url: 'javascript:alert(1)' },
    ]
    const html = renderToStaticMarkup(<Competitors brief={briefWith(hostile)} />)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('Bad link')
  })
})
