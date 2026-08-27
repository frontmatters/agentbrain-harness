import { BrandWordmark, NeuralLogo } from '@agentbrain-harness/client-ui-primitives'
import type { HeroBrandMarkOwnerProps } from '@agentbrain-harness/client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@agentbrain-harness/client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official animated agentBrain logo.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <NeuralLogo size={size} className={className} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} size={28} />
}
