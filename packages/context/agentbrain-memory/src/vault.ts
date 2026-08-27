/** Pure AgentBrain memory-note logic; no filesystem access. */

import { createHash } from 'node:crypto'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

/** One canonical AgentBrain memory note. */
export interface MemoryDoc {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly tags: string
  readonly created: string
  readonly updated: string
  readonly content: string
}

/** Convert a memory name to its Markdown filename.
 * @param name Memory name.
 * @returns Markdown filename.
 */
export function idToFileName(name: string): string { return `${name}.md` }

/** Recover a memory name from a Markdown filename.
 * @param name Markdown filename.
 * @returns Memory name, or undefined for a non-memory filename.
 */
export function fileNameToId(name: string): string | undefined {
  return name.endsWith('.md') && name.length > 3 ? name.slice(0, -3) : undefined
}

/** Create an AgentBrain-compatible filesystem name from a title.
 * @param title Note title.
 * @returns Filesystem-safe memory name.
 */
export function slugify(title: string): string {
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return value || 'memory'
}

/** Normalize a comma-separated tag list.
 * @param tags Comma-separated tags, or undefined.
 * @returns Normalized comma-separated tags.
 */
export function normalizeTags(tags: string | undefined): string {
  return tags === undefined ? '' : tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean).join(',')
}

/** Generate the UUID5 used by AgentBrain for a vault-relative note path.
 * @param namespace UUID namespace.
 * @param vaultRelativePath Vault-relative note path.
 * @returns UUID5 string.
 */
export function uuid5(namespace: string, vaultRelativePath: string): string {
  const normalized = namespace.replaceAll('-', '')
  if (!/^[0-9a-f]{32}$/iu.test(normalized)) throw new Error('AgentBrain namespace must be a UUID')
  const namespaceBytes = Buffer.from(normalized, 'hex')
  const digest = createHash('sha1').update(namespaceBytes).update(`agentBrain/${vaultRelativePath}`).digest()
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80
  const hex = digest.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Render canonical AgentBrain memory frontmatter and body.
 * @param doc Memory document to render.
 * @returns Markdown document text.
 */
export function renderDoc(doc: MemoryDoc): string {
  const tags = doc.tags === '' ? undefined : doc.tags.split(',')
  const metadata = {
    node_type: 'memory',
    type: 'memory',
    ...(tags === undefined ? {} : { tags }),
    ...(doc.created === '' ? {} : { created: doc.created }),
    ...(doc.updated === '' ? {} : { updated: doc.updated }),
  }
  return `---\n${stringifyYaml({
    id: doc.id,
    name: doc.name,
    description: doc.description,
    metadata,
  }).trimEnd()}\n---\n\n${doc.content.trim()}\n`
}

/** Parse canonical AgentBrain notes and tolerate legacy ABH memory notes.
 * @param name Fallback note name.
 * @param text Markdown document text.
 * @returns Parsed memory document, or undefined when the document is invalid.
 */
export function parseDoc(name: string, text: string): MemoryDoc | undefined {
  const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(text)
  if (match === null || match[1] === undefined || match[2] === undefined) return undefined
  const frontmatter = parseYaml(match[1]) as Record<string, unknown> | null
  if (frontmatter === null || typeof frontmatter !== 'object') return undefined
  if (name === 'MEMORY') return undefined
  const metadata = frontmatter.metadata
  const metadataRecord = metadata !== null && typeof metadata === 'object' ? metadata as Record<string, unknown> : {}
  const isMemoryNode = metadataRecord.node_type === 'memory' || metadataRecord.type === 'memory'
  if (isMemoryNode && typeof frontmatter.id !== 'string') return undefined
  const description = typeof frontmatter.description === 'string'
    ? frontmatter.description
    : typeof frontmatter.title === 'string' ? frontmatter.title : undefined
  if (description === undefined || match[2].trim() === '') return undefined
  const rawTags = metadataRecord.tags ?? frontmatter.tags
  const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === 'string').join(',') : typeof rawTags === 'string' ? rawTags : ''
  return {
    id: typeof frontmatter.id === 'string' ? frontmatter.id : '',
    name: typeof frontmatter.name === 'string' ? frontmatter.name : name,
    description,
    tags: normalizeTags(tags),
    created: typeof metadataRecord.created === 'string' ? metadataRecord.created : typeof frontmatter.created === 'string' ? frontmatter.created : '',
    updated: typeof metadataRecord.updated === 'string' ? metadataRecord.updated : typeof frontmatter.updated === 'string' ? frontmatter.updated : '',
    content: match[2].trim(),
  }
}

/** Match every requested query term and an optional exact tag.
 * @param doc Memory document to inspect.
 * @param query Whitespace-separated query terms, or undefined.
 * @param tag Exact tag filter, or undefined.
 * @returns Whether the document matches all filters.
 */
export function matchesQuery(doc: MemoryDoc, query: string | undefined, tag: string | undefined): boolean {
  if (tag !== undefined && tag.trim() !== '' && !doc.tags.split(',').map(value => value.trim()).includes(tag.trim().toLowerCase())) return false
  if (query === undefined || query.trim() === '') return true
  const haystack = `${doc.name}\n${doc.description}\n${doc.tags}\n${doc.content}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(term => haystack.includes(term))
}
