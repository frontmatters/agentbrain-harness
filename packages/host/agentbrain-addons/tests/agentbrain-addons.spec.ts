import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { AgentbrainAddonsGateway, parseAddonId } from '../src/index.ts'

describe('addon ids', () => {
  it('accepts lowercase hyphenated ids', () => {
    expect(parseAddonId('youtube-digest')).toBe('youtube-digest')
  })

  it.each(['', '../voice', 'Voice', 'voice/foo', 'voice;rm'])('rejects unsafe id %j', (id) => {
    expect(() => parseAddonId(id)).toThrow(/invalid addon id/)
  })
})

describe('addon inventory', () => {
  const previousRoot = process.env.AGENTBRAIN_DIR

  afterEach(() => {
    if (previousRoot === undefined) delete process.env.AGENTBRAIN_DIR
    else process.env.AGENTBRAIN_DIR = previousRoot
  })

  it('ignores filesystem metadata, prefers local manifests, and reads support', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abh-addons-'))
    process.env.AGENTBRAIN_DIR = root
    await mkdir(join(root, 'local', 'addons', 'shared-addon'), { recursive: true })
    await mkdir(join(root, 'system', 'addons', 'shared-addon'), { recursive: true })
    await writeFile(join(root, 'local', 'addons', '.DS_Store'), '')
    await writeFile(join(root, 'local', 'addons', 'shared-addon', 'manifest.md'), '---\nname: Local addon\nversion: 2.0.0\nsupport:\n  pi: full\n---\n')
    await writeFile(join(root, 'system', 'addons', 'shared-addon', 'manifest.md'), '---\nname: Bundled addon\nversion: 1.0.0\n---\n')
    const script = join(root, 'scripts', 'addons.sh')
    await mkdir(join(root, 'scripts'), { recursive: true })
    await writeFile(script, '')

    const gateway = Object.create(AgentbrainAddonsGateway.prototype) as AgentbrainAddonsGateway
    Object.defineProperty(gateway, 'script', { value: script })
    const result = await gateway.list()

    expect(result.addons).toHaveLength(1)
    expect(result.addons[0]).toMatchObject({ name: 'Local addon', version: '2.0.0', support: { pi: 'full' } })
  })
})
