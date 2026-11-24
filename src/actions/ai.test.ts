import { describe, expect, it } from 'vitest'
import { newBrief, type Brief } from '../schemas/briefs-schema'
import { buildUserMessage, explainAiError, parseAiAnswer } from './ai'
import { TIMED_OUT } from './call-integration'

describe('parseAiAnswer', () => {
  it('reads a plain JSON answer', () => {
    // The shape of the real answer the AI gave for honojs/hono.
    const text = '{"summary": "Hono is a small web framework.", "audience": "Web developers."}'
    expect(parseAiAnswer(text)).toEqual({
      summary: 'Hono is a small web framework.',
      audience: 'Web developers.',
    })
  })

  it('reads JSON that has extra words or ``` marks around it', () => {
    const text = 'Here you go:\n```json\n{"summary": "S", "audience": "A"}\n```'
    expect(parseAiAnswer(text)).toEqual({ summary: 'S', audience: 'A' })
  })

  it('returns null when the answer is not usable', () => {
    expect(parseAiAnswer('I cannot help with that.')).toBeNull()
    expect(parseAiAnswer('{"summary": "only one part"}')).toBeNull()
    expect(parseAiAnswer('{"summary": 42, "audience": ["x"]}')).toBeNull()
    expect(parseAiAnswer('{"summary": "cut off in the mid')).toBeNull()
    expect(parseAiAnswer(undefined)).toBeNull()
  })

  it('cuts an answer that is far too long', () => {
    const text = JSON.stringify({ summary: 'x'.repeat(5000), audience: 'y'.repeat(5000) })
    const answer = parseAiAnswer(text)
    expect(answer?.summary).toHaveLength(800)
    expect(answer?.audience).toHaveLength(500)
  })
})

describe('buildUserMessage', () => {
  it('wraps the repository facts in <repository> tags', () => {
    const brief: Brief = {
      ...newBrief('https://github.com/honojs/hono', 'honojs', 'hono'),
      description: 'Web framework',
      language: 'TypeScript',
      topics: ['web', 'framework'],
      readme: '# Hono',
    }
    const message = buildUserMessage(brief)
    expect(message.startsWith('<repository>')).toBe(true)
    expect(message.endsWith('</repository>')).toBe(true)
    expect(message).toContain('Name: honojs/hono')
    expect(message).toContain('Topics: web, framework')
    expect(message).toContain('# Hono')
  })

  it('says so when a field is empty instead of leaving a blank', () => {
    const message = buildUserMessage(newBrief('https://github.com/a/b', 'a', 'b'))
    expect(message).toContain('Description: (none)')
    expect(message).toContain('(no README)')
  })
})

describe('explainAiError', () => {
  it('explains a timeout', () => {
    expect(explainAiError(TIMED_OUT)).toBe('The AI took too long to answer. Please try again.')
  })

  it('falls back to a general message that keeps the details', () => {
    expect(explainAiError('anthropic/chat-completion (500)')).toContain('(Details: anthropic/chat-completion (500))')
  })
})
