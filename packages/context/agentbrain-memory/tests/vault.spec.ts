import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeTags, parseDoc, renderDoc, slugify, uuid5, type MemoryDoc } from '../src/vault.ts'

const doc: MemoryDoc = {
  id: 'b1a8487e-94fa-5b45-8a09-a57a5fdca9b8', name: 'deploy-decisions', description: 'Deploy decisions', tags: 'ops,deploys',
  created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z', content: 'Deploy on Tuesdays.',
}

describe('AgentBrain memory notes', () => {
  it('round-trips canonical frontmatter and body', () => expect(parseDoc(doc.name, renderDoc(doc))).toEqual(doc))
  it('matches the canonical uuid5 generator', () => expect(uuid5('e37d107c-9344-4626-806e-8da1b442c8e4', 'local/memories/deploy-decisions')).toBe(doc.id))
  it('parses existing AgentBrain memory frontmatter', () => {
    const parsed = parseDoc('feedback-agent-agnostic', '---\nid: abc\nname: feedback-agent-agnostic\ndescription: Agent agnostic\nmetadata:\n  node_type: memory\n  type: feedback\n  tags: [architecture]\n---\n\nKeep the core agent-agnostic.\n')
    expect(parsed).toMatchObject({ name: 'feedback-agent-agnostic', description: 'Agent agnostic', tags: 'architecture' })
  })
  it('ignores the auto-generated MEMORY index and malformed memory nodes', () => {
    expect(parseDoc('MEMORY', '---\nmetadata:\n  node_type: memory\n---\n\nIndex.\n')).toBeUndefined()
    expect(parseDoc('broken', '---\nname: broken\ndescription: Broken\nmetadata:\n  node_type: memory\n---\n\nBody.\n')).toBeUndefined()
  })
  it('slugifies titles and falls back for punctuation-only titles', () => {
    expect(slugify('Deploy Decisions!')).toBe('deploy-decisions')
    expect(slugify('???')).toBe('memory')
  })
  it('matches all query terms and exact tags', () => {
    expect(matchesQuery(doc, 'deploy tuesdays', 'OPS')).toBe(true)
    expect(matchesQuery(doc, 'deploy mondays', undefined)).toBe(false)
  })
  it('normalizes tags', () => expect(normalizeTags(' Ops , , Deploys ')).toBe('ops,deploys'))
})
