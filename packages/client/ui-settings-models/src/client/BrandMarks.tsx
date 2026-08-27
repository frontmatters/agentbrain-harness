/**
 * Provider brand marks for the account-login buttons and local runtime row.
 * OpenAI, Anthropic, and xAI, GitHub, Kimi, OpenRouter, and Ollama ship inline
 * logomarks referenced by an overlay logo id; every other provider renders a
 * monogram derived from its
 * display name. Provider selection remains overlay data, while this module
 * contains only the reusable logo artwork.
 *
 * @module @agentbrain-harness/client-ui-settings-models/BrandMarks
 */

import type { ReactNode } from 'react'

/** The OpenAI logomark, drawn in `currentColor` so it takes the button's text colour. */
function OpenAiMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

/** The Anthropic logomark, drawn in the brand orange that identifies Claude. */
function AnthropicMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 46 32" fill="#d97757" aria-hidden focusable="false">
      <path d="M32.73 0h-6.945L38.45 32h6.945L32.73 0ZM12.665 0 0 32h7.082l2.59-6.72h13.25l2.59 6.72h7.082L19.929 0h-7.264Zm-.702 19.337 4.334-11.246 4.334 11.246h-8.668Z" />
    </svg>
  )
}

/** The xAI logomark (the angular X of Grok), drawn in `currentColor`. */
function XaiMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M3.6 2h4.02l5.1 7.28L6.66 2H10.7l3.02 4.32L18.34 2h1.86l-5.5 6.9L21 22h-4.02l-5.4-7.72L5.9 22H4.04l5.8-7.28L3.6 2Zm2.9 1.4 11.6 17.2h1.34L7.84 3.4H6.5Z" />
    </svg>
  )
}

/** The GitHub mark used by GitHub Copilot. */
function GitHubMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.84 2.8 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}

/** The Kimi crescent-and-star mark. */
function KimiMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A7.65 7.65 0 1 1 12 4.5a7.72 7.72 0 0 1 0-2.25Z" />
      <path d="m16.75 5.1.58 1.57 1.57.58-1.57.58-.58 1.57-.58-1.57-1.57-.58 1.57-.58.58-1.57Z" />
    </svg>
  )
}

/** The Ollama mark, rendered as a simple local-runtime rosette. */
function OllamaMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 14c1.8 1.7 5.2 1.7 7 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The OpenRouter layered triangle mark. */
function OpenRouterMark({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M5.1 5.1a3.1 3.1 0 0 1 4.38 0l1.06 1.06a2.08 2.08 0 0 0 2.94 0l1.06-1.06a3.1 3.1 0 1 1 4.38 4.38l-1.06 1.06a2.08 2.08 0 0 0 0 2.94l1.06 1.06a3.1 3.1 0 1 1-4.38 4.38l-1.06-1.06a2.08 2.08 0 0 0-2.94 0l-1.06 1.06a3.1 3.1 0 1 1-4.38-4.38l1.06-1.06a2.08 2.08 0 0 0 0-2.94L5.1 9.48A3.1 3.1 0 0 1 5.1 5.1Zm1.59 1.59a.85.85 0 0 0 0 1.2l1.06 1.06a4.33 4.33 0 0 1 0 6.12l-1.06 1.06a.85.85 0 1 0 1.2 1.2l1.06-1.06a4.33 4.33 0 0 1 6.12 0l1.06 1.06a.85.85 0 1 0 1.2-1.2l-1.06-1.06a4.33 4.33 0 0 1 0-6.12l1.06-1.06a.85.85 0 1 0-1.2-1.2l-1.06 1.06a4.33 4.33 0 0 1-6.12 0L7.9 6.69a.85.85 0 0 0-1.2 0Z" />
    </svg>
  )
}

/** A deterministic hue in [0,360) from a name, so a provider's monogram colour is stable. */
function hueFromName(name: string): number {
  let hash = 7
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 360
  return hash
}

/** A lettered tile for a provider without an inline logomark: first letter, colour from the name. */
function Monogram({ name, className }: { name: string; className?: string | undefined }): ReactNode {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect width="24" height="24" rx="6" fill={`hsl(${hueFromName(name)} 52% 45%)`} />
      <text
        x="12" y="12" fill="#fff" fontSize="13" fontWeight="700"
        textAnchor="middle" dominantBaseline="central"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
      >
        {letter}
      </text>
    </svg>
  )
}

/**
 * Render a provider's brand mark: an inline logomark when the overlay names one
 * of the shipped assets, otherwise a monogram from the display name.
 * @param props.logo - the overlay logo id, or undefined for a monogram.
 * @param props.name - the display name, used for the monogram letter and colour.
 * @param props.className - class applied to the mark for sizing.
 * @returns the logomark or monogram as an inline SVG.
 */
export function ProviderMark(
  { logo, name, className }: { logo?: string | undefined; name: string; className?: string | undefined },
): ReactNode {
  switch (logo) {
    case 'openai':
      return <OpenAiMark className={className} />
    case 'anthropic':
      return <AnthropicMark className={className} />
    case 'xai':
      return <XaiMark className={className} />
    case 'github':
      return <GitHubMark className={className} />
    case 'kimi':
      return <KimiMark className={className} />
    case 'openrouter':
      return <OpenRouterMark className={className} />
    case 'ollama':
      return <OllamaMark className={className} />
    default:
      return <Monogram name={name} className={className} />
  }
}
