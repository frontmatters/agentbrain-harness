/** Official agentBrain Harness occupants for the generic browser-brand slots. */
import type { ClientContext } from '@agentbrain-harness/client-runtime/client'
import type {} from '@agentbrain-harness/client-ui-conversation/client'
import type {} from '@agentbrain-harness/client-ui-sidebar/client'
import { OfficialBrandMark, OfficialBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill every shipped brand slot as one declaration-aware registration set.
 * The agentBrain brand ships in every build, so the occupants register
 * unconditionally; the shell keeps its generic fallbacks only as a safety net
 * for a build that omits this plugin entirely.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark' }, OfficialBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name' }, OfficialBrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, OfficialBrandMark)
      })))
}
