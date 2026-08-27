import { fileURLToPath } from 'node:url'
import { Context } from '@agentbrain-harness/cordis'
import { agentEvents, Inbox, type Agent } from '@agentbrain-harness/agent'
import { CallId } from '@agentbrain-harness/llm'
import { boot, loadOverlayPatches } from '@agentbrain-harness/app-boot'
import { SessionId } from '@agentbrain-harness/session'
import type {} from '@agentbrain-harness/skill'
import type {} from '@agentbrain-harness/tools'

const overlayPath = process.argv[2]
if (overlayPath === undefined) throw new Error('abh-badge snapshot requires an overlay path')
const rootConfigPath = fileURLToPath(new URL('../../../../../packages/bundle/base/tests/fixtures/root.cordis.yml', import.meta.url))
const basePatchPath = fileURLToPath(new URL('../../../../../packages/bundle/base/cordis.patch.yml', import.meta.url))
const ctx = await boot('abh-badge-snapshot', rootConfigPath, [
  ...loadOverlayPatches('abh-badge-snapshot', basePatchPath),
  ...loadOverlayPatches('abh-badge-snapshot', overlayPath),
])

try {
  const agentId = SessionId('abh-badge-snapshot')
  const session = ctx.sessions.create(agentId, { meta: { cwd: process.cwd() } })
  const agent: Agent = {
    ctx: new Context(),
    id: agentId,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('abh-badge snapshot must receive the catalog at the step boundary') },
    cancel: () => {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [], turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: 'enter' as const, messages: [] }),
  )
  const catalog = decision.kind === 'enter'
    ? decision.messages.find(message => message.role === 'user'
      && message.source.kind === 'skill-catalog')?.content
    : undefined
  const summary = (await ctx.skills.list()).find(skill => skill.name === 'abh-badge')
  const result = await ctx.tools.execute({
    callId: CallId('abh-badge-snapshot'),
    name: 'skill',
    arguments: { name: 'abh-badge' },
    signal: new AbortController().signal,
  })
  process.stdout.write(`${JSON.stringify({ catalog: catalog ?? null, summary: summary ?? null, result })}\n`)
} finally {
  await ctx.fiber.dispose()
}
