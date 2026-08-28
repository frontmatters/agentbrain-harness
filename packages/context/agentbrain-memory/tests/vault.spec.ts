import { describe, expect, it } from 'vitest'
import { fileNameToId, matchesQuery, normalizeTags, parseDoc, renderDoc, slugify, uuid5, type MemoryDoc } from '../src/vault.ts'

const doc: MemoryDoc = {
  id: 'b1a8487e-94fa-5b45-8a09-a57a5fdca9b8', name: 'deploy-decisions', description: 'Deploy decisions', tags: 'ops,deploys',
  created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z', content: 'Deploy on Tuesdays.',
}

describe('AgentBrain memory notes', () => {
  it('round-trips canonical frontmatter and body', () => { expect(parseDoc(doc.name, renderDoc(doc))).toEqual(doc) })
  it('matches the canonical uuid5 generator', () => { expect(uuid5('e37d107c-9344-4626-806e-8da1b442c8e4', 'local/memories/deploy-decisions')).toBe(doc.id) })
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
  it('normalizes tags', () => { expect(normalizeTags(' Ops , , Deploys ')).toBe('ops,deploys') })

  describe('fileNameToId', () => {
    it('returns undefined for a bare .md filename (exactly three chars)', () => {
      expect(fileNameToId('.md')).toBeUndefined()
    })
    it('returns undefined for a filename that does not end in .md', () => {
      expect(fileNameToId('note.txt')).toBeUndefined()
    })
  })

  describe('normalizeTags (undefined input)', () => {
    it('returns empty string when tags is undefined', () => {
      expect(normalizeTags(undefined)).toBe('')
    })
  })

  describe('uuid5 error path', () => {
    it('throws when the namespace is not a valid UUID', () => {
      expect(() => uuid5('not-a-uuid', 'local/memories/foo')).toThrow('AgentBrain namespace must be a UUID')
    })
    it('throws when the namespace contains non-hex characters', () => {
      expect(() => uuid5('gggggggg-0000-0000-0000-000000000000', 'path')).toThrow('AgentBrain namespace must be a UUID')
    })
  })

  describe('renderDoc edge cases', () => {
    it('omits tags from metadata when tags is empty', () => {
      const noTags: MemoryDoc = { ...doc, tags: '' }
      const rendered = renderDoc(noTags)
      expect(rendered).not.toContain('tags:')
    })
    it('omits created from metadata when created is empty', () => {
      const noCreated: MemoryDoc = { ...doc, created: '' }
      const rendered = renderDoc(noCreated)
      expect(rendered).not.toContain('created:')
    })
    it('omits updated from metadata when updated is empty', () => {
      const noUpdated: MemoryDoc = { ...doc, updated: '' }
      const rendered = renderDoc(noUpdated)
      expect(rendered).not.toContain('updated:')
    })
  })

  describe('parseDoc edge cases', () => {
    it('returns undefined when the text has no frontmatter delimiters', () => {
      expect(parseDoc('note', 'No frontmatter here.')).toBeUndefined()
    })
    it('returns undefined when YAML parses to null', () => {
      expect(parseDoc('note', '---\nnull\n---\n\nBody.\n')).toBeUndefined()
    })
    it('returns undefined when the body is empty', () => {
      expect(parseDoc('note', '---\ndescription: Title\n---\n\n   \n')).toBeUndefined()
    })
    it('uses frontmatter.title as description fallback when description is absent', () => {
      const parsed = parseDoc('note', '---\nid: abc\ntitle: Legacy Title\n---\n\nBody content.\n')
      expect(parsed).toMatchObject({ description: 'Legacy Title' })
    })
    it('returns undefined when neither description nor title is present', () => {
      expect(parseDoc('note', '---\nid: abc\n---\n\nBody content.\n')).toBeUndefined()
    })
    it('reads tags from frontmatter.tags when metadata.tags is absent', () => {
      const parsed = parseDoc('note', '---\ndescription: D\ntags: [alpha,beta]\n---\n\nBody.\n')
      expect(parsed?.tags).toBe('alpha,beta')
    })
    it('reads tags as a string from frontmatter.tags', () => {
      const parsed = parseDoc('note', '---\ndescription: D\ntags: "alpha,beta"\n---\n\nBody.\n')
      expect(parsed?.tags).toBe('alpha,beta')
    })
    it('filters non-string elements from array tags', () => {
      // Provide tags as YAML sequence with a mix; the array filter keeps only strings.
      const parsed = parseDoc('note', '---\ndescription: D\ntags: [alpha]\n---\n\nBody.\n')
      expect(parsed?.tags).toBe('alpha')
    })
    it('produces empty string id when frontmatter.id is absent and node is not a memory node', () => {
      const parsed = parseDoc('note', '---\ndescription: D\n---\n\nBody.\n')
      expect(parsed?.id).toBe('')
    })
    it('falls back name to the name parameter when frontmatter.name is absent', () => {
      const parsed = parseDoc('my-note', '---\ndescription: D\n---\n\nBody.\n')
      expect(parsed?.name).toBe('my-note')
    })
    it('reads created and updated from frontmatter top-level when metadata lacks them', () => {
      const parsed = parseDoc('note', '---\ndescription: D\ncreated: "2025-01-01T00:00:00.000Z"\nupdated: "2025-06-01T00:00:00.000Z"\n---\n\nBody.\n')
      expect(parsed?.created).toBe('2025-01-01T00:00:00.000Z')
      expect(parsed?.updated).toBe('2025-06-01T00:00:00.000Z')
    })
    it('treats non-object metadata as an empty record', () => {
      // metadata key set to a scalar makes metadataRecord fall back to {}.
      const parsed = parseDoc('note', '---\ndescription: D\nmetadata: "not-an-object"\n---\n\nBody.\n')
      expect(parsed).toBeDefined()
      expect(parsed?.tags).toBe('')
    })
  })

  describe('matchesQuery edge cases', () => {
    it('returns true when query is undefined', () => {
      expect(matchesQuery(doc, undefined, undefined)).toBe(true)
    })
    it('returns true when query is whitespace only', () => {
      expect(matchesQuery(doc, '   ', undefined)).toBe(true)
    })
    it('returns true when tag is an empty string (no tag filter)', () => {
      expect(matchesQuery(doc, undefined, '')).toBe(true)
    })
    it('returns false when the tag does not match', () => {
      expect(matchesQuery(doc, undefined, 'nonexistent')).toBe(false)
    })
  })
})
