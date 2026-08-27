/** Browser plugin for durable workflow-run Conversation Nodes. */

import type { ClientContext, SessionId } from '@agentbrain-harness/client-runtime/client'
import type {} from '@agentbrain-harness/client-locale/client'
import type {} from '@agentbrain-harness/client-ui-conversation/client'
import { WorkflowRunPanel, type WorkflowRunInjected } from './WorkflowRunPanel.tsx'
import { en, NS, type WorkflowRunKey, nl } from './locales.ts'
import { workflowRunDefinition } from './workflow-definition.ts'

declare module '@agentbrain-harness/client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Durable workflow-run node copy. */
    workflowRun: WorkflowRunKey
  }
}

/** Required services for Definition, keyed renderer, navigation, and copy. */
export const inject = ['conversationEvents', 'slots', 'sessions', 'locale']

/** Register the workflow Definition, dictionary, and keyed Chat renderer. */
export function apply(ctx: ClientContext): void {
  ctx.conversationEvents.register(workflowRunDefinition)
  ctx.effect(() => ctx.locale.register(NS, { nl, en }), 'ui-workflow-run: dictionaries')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'workflow-run',
    locale: NS,
    inject: (): WorkflowRunInjected => ({
      openSession: (id: SessionId) => { ctx.sessions.open(id) },
    }),
  }, WorkflowRunPanel))
}
