/**
 * REAL-composition coverage for the AgentBrain integration: Loader mounts the
 * filesystem skill provider, command bridge, and memory tools from cordis.yml.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import type { Agent } from '@agentbrain-harness/agent'
import { CallId } from '@agentbrain-harness/llm'
import Loader from '@agentbrain-harness/cordis-plugin-loader'
import Include from '@agentbrain-harness/cordis-plugin-include'
import LocalFileSystem from '@agentbrain-harness/fs-local'
import Commands from '@agentbrain-harness/commands'
import SkillRegistry from '@agentbrain-harness/skill'
import SystemPrompt from '@agentbrain-harness/system-prompt'
import ToolRuntime from '@agentbrain-harness/tools'
import * as SkillFilesystem from '@agentbrain-harness/skill-filesystem'
import * as AgentBrainCommands from '@agentbrain-harness/agentbrain-commands'
import * as AgentBrainMemory from '../src/index.ts'

let root: string | undefined
const contexts: Context[] = []

async function writeSkill(brain: string): Promise<void> {
  const skillDir = join(brain, 'system', 'skills', 'release-note')
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), [
    '---',
    'name: release-note',
    'description: Write a release note.',
    'user-invocable: true',
    '---',
    '',
    'Use the release checklist.',
    '',
  ].join('\n'))
}

async function loadComposition(brain: string): Promise<Context> {
  const configPath = join(root!, 'cordis.yml')
  await writeFile(configPath, [
    '- name: \'@agentbrain-harness/fs-local\'',
    '  config:',
    `    cwd: ${JSON.stringify(root)}`,
    '- name: \'@agentbrain-harness/system-prompt\'',
    '- name: \'@agentbrain-harness/tools\'',
    '- name: \'@agentbrain-harness/commands\'',
    '- name: \'@agentbrain-harness/skill\'',
    '- name: \'@agentbrain-harness/skill-filesystem\'',
    '  config:',
    `    agentBrainHome: ${JSON.stringify(brain)}`,
    '    includeDefaultRoots: true',
    '    includeAgentBrainRoots: true',
    '    watch: false',
    '- name: \'@agentbrain-harness/agentbrain-commands\'',
    '- name: \'@agentbrain-harness/agentbrain-memory\'',
    '  config:',
    `    agentBrainHome: ${JSON.stringify(brain)}`,
    '',
  ].join('\n'))

  const context = new Context()
  contexts.push(context)
  context.baseUrl = pathToFileURL(root!).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@agentbrain-harness/fs-local', LocalFileSystem],
    ['@agentbrain-harness/system-prompt', SystemPrompt],
    ['@agentbrain-harness/tools', ToolRuntime],
    ['@agentbrain-harness/commands', Commands],
    ['@agentbrain-harness/skill', SkillRegistry],
    ['@agentbrain-harness/skill-filesystem', SkillFilesystem],
    ['@agentbrain-harness/agentbrain-commands', AgentBrainCommands],
    ['@agentbrain-harness/agentbrain-memory', AgentBrainMemory],
  ])
  context.loader.internal = {
    version: 'agentbrain-composition-test',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await context.loader.await()
  return context
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('AgentBrain Loader composition', () => {
  it('discovers a user-invocable AgentBrain skill and bridges it into commands', async () => {
    root = await mkdtemp(join(tmpdir(), 'abh-agentbrain-composition-'))
    const brain = join(root, 'brain')
    await mkdir(join(brain, 'local', 'memories'), { recursive: true })
    await mkdir(join(brain, 'system'), { recursive: true })
    await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
    await writeSkill(brain)
    const context = await loadComposition(brain)

    await expect.poll(async () => (await context.skills.list()).map(skill => skill.name)).toEqual(['release-note'])
    const commands = context.commands.list({} as Agent)
    expect(commands).toEqual([{ name: 'release-note', description: 'Write a release note.' }])
  })

  it('shares canonical memory between independently loaded sessions', async () => {
    root = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-composition-'))
    const brain = join(root, 'brain')
    await mkdir(join(brain, 'local', 'memories'), { recursive: true })
    await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))

    const first = await loadComposition(brain)
    const saved = await first.tools.execute({ signal: new AbortController().signal, callId: CallId('composition-save'), name: 'memory_save', arguments: { title: 'Release decision', content: 'Use the assembled Loader path.', tags: 'testing' } })
    expect(saved.isError).toBe(false)
    expect(await readFile(join(brain, 'local', 'memories', 'release-decision.md'), 'utf8')).toContain('node_type: memory')
    await first.fiber.dispose()

    const second = await loadComposition(brain)
    const recalled = await second.tools.execute({ signal: new AbortController().signal, callId: CallId('composition-recall'), name: 'memory_recall', arguments: { query: 'assembled loader' } })
    expect(recalled.isError).toBe(false)
    expect(recalled.value).toMatchObject({ memories: [{ title: 'Release decision', content: 'Use the assembled Loader path.' }] })
  })
})
