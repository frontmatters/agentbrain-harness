/** Assistant block classifier (moved here with the conversation view-model). */

import { describe, expect, it } from 'vitest'
import { AttachmentId } from '@agentbrain-harness/attachment'
import type { ContentBlock } from '@agentbrain-harness/api-remotes/client'
import { toAssistantBlock, toAssistantBlocks } from '../src/client/contract/conversation-model.ts'

describe('toAssistantBlock', () => {
  it('classifies the four block shapes', () => {
    const attachment = {
      attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`),
      mediaType: 'image/png' as const,
      bytes: 68,
      width: 1,
      height: 1,
    }
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'berichttekst' },
      { type: 'reasoning', text: 'denkproces' },
      { type: 'tool-call', id: 'c1', name: 'echo', arguments: '{}' } as ContentBlock,
      { type: 'image', attachment },
    ]
    expect(toAssistantBlocks(blocks)).toEqual([
      { kind: 'text', text: 'berichttekst' },
      { kind: 'reasoning', text: 'denkproces' },
      { kind: 'tool-call', callId: 'c1', name: 'echo', argsRaw: '{}' },
      { kind: 'image', attachment },
    ])
    expect(toAssistantBlock(blocks[0] as ContentBlock)).toEqual({ kind: 'text', text: 'berichttekst' })
  })
})
