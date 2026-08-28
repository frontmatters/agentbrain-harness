/**
 * Framework-free boot page and failure report. It remains available when a
 * client plugin fails because React arrives only with the UI renderer.
 * @module @agentbrain-harness/client-web/src/boot-page
 */
import type { LoaderEntryState } from './loader-status.ts'
import css from './boot-page.module.css'

/** Create a div with one module class and optional text. */
function div(className: string | undefined, text?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className ?? ''
  if (text !== undefined) el.textContent = text
  return el
}

/**
 * The official brand wordmark as inline SVG: the static neural mark (the
 * `BrainMark` still of the animated `NeuralLogo`), "agentBrain", and the
 * HARNESS badge. Mirrors the React `BrandWordmark`; the boot page runs
 * before React, so it carries its own copy. Ink rides `currentColor`; the badge
 * text is knocked out in the inverted label colour.
 */
const BRAND_WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="182" height="24" viewBox="0 0 182 24" fill="none" aria-hidden="true">
<text x="27" y="17.5" font-family="var(--ab-web-font-family)" font-size="16" font-weight="600" letter-spacing="-0.3" fill="currentColor">agentBrain</text>
<g transform="translate(1 2) scale(0.5)">
<g stroke="currentColor" stroke-linecap="round"><line x1="20" y1="20" x2="24.92" y2="22.54" stroke-opacity="0.32" stroke-width="0.76"/><line x1="20" y1="20" x2="11.13" y2="25.74" stroke-opacity="0.44" stroke-width="0.97"/><line x1="20" y1="20" x2="17.04" y2="30.73" stroke-opacity="0.36" stroke-width="0.81"/><line x1="20" y1="20" x2="22.71" y2="7.82" stroke-opacity="0.41" stroke-width="0.9"/><line x1="20" y1="20" x2="15.78" y2="14.29" stroke-opacity="0.32" stroke-width="0.77"/><line x1="20" y1="20" x2="29.2" y2="17.39" stroke-opacity="0.46" stroke-width="1"/><line x1="20" y1="20" x2="17.93" y2="25.56" stroke-opacity="0.31" stroke-width="0.76"/><line x1="20" y1="20" x2="25.36" y2="31.31" stroke-opacity="0.44" stroke-width="0.96"/><line x1="20" y1="20" x2="31.37" y2="13.83" stroke-opacity="0.4" stroke-width="0.88"/><line x1="24.92" y1="22.54" x2="17.93" y2="25.56" stroke-opacity="0.25" stroke-width="0.67"/><line x1="17.93" y1="25.56" x2="17.04" y2="30.73" stroke-opacity="0.29" stroke-width="0.72"/><line x1="17.04" y1="30.73" x2="25.36" y2="31.31" stroke-opacity="0.41" stroke-width="0.92"/><line x1="25.36" y1="31.31" x2="11.13" y2="25.74" stroke-opacity="0.5" stroke-width="1.08"/><line x1="11.13" y1="25.74" x2="29.2" y2="17.39" stroke-opacity="0.51" stroke-width="1.12"/><line x1="29.2" y1="17.39" x2="31.37" y2="13.83" stroke-opacity="0.47" stroke-width="1.03"/><line x1="31.37" y1="13.83" x2="15.78" y2="14.29" stroke-opacity="0.34" stroke-width="0.8"/><line x1="15.78" y1="14.29" x2="24.92" y2="22.54" stroke-opacity="0.25" stroke-width="0.68"/><line x1="22.71" y1="7.82" x2="31.37" y2="13.83" stroke-opacity="0.43" stroke-width="0.93"/><line x1="22.71" y1="7.82" x2="15.78" y2="14.29" stroke-opacity="0.35" stroke-width="0.82"/></g>
<g fill="currentColor"><circle cx="17.93" cy="25.56" r="1.18" fill-opacity="0.54"/><circle cx="24.92" cy="22.54" r="1.19" fill-opacity="0.54"/><circle cx="15.78" cy="14.29" r="1.22" fill-opacity="0.56"/><circle cx="17.04" cy="30.73" r="1.37" fill-opacity="0.67"/><circle cx="20" cy="20" r="2.1" fill-opacity="0.75"/><circle cx="31.37" cy="13.83" r="1.61" fill-opacity="0.8"/><circle cx="22.71" cy="7.82" r="1.68" fill-opacity="0.84"/><circle cx="25.36" cy="31.31" r="1.89" fill-opacity="0.92"/><circle cx="11.13" cy="25.74" r="1.92" fill-opacity="0.93"/><circle cx="29.2" cy="17.39" r="2.04" fill-opacity="0.96"/></g>
</g>
<rect x="129.348" y="5.5" width="52" height="14" rx="2" fill="currentColor"/>
<g clip-path="url(#abh-boot-wordmark-badge)" fill="var(--ab-web-alias-label-primary-inverted, var(--ab-harness-boot-bg, #0e0e10))">
<path d="M132.848 8.93205H134.08V16.137H132.848V8.93205ZM136.5 8.93205H137.732V16.137H136.5V8.93205ZM133.365 13.024V11.99H137.193V13.024H133.365Z"/>
<path d="M140.397 14.432L140.672 13.453H143.202L143.532 14.432H140.397ZM140.287 16.137H139.055L141.277 8.93205H142.201L142.146 9.74605L140.947 13.915H140.969L140.287 16.137ZM145.039 16.137H143.741L143.07 13.948L143.081 13.937L141.871 9.74605L141.926 8.93205H142.817L145.039 16.137Z"/>
<path d="M146.846 8.93205H149.068C149.852 8.93205 150.443 9.11538 150.839 9.48205C151.235 9.84138 151.433 10.3327 151.433 10.956C151.433 11.22 151.396 11.4657 151.323 11.693C151.249 11.9204 151.125 12.1257 150.949 12.309C150.773 12.4924 150.531 12.65 150.223 12.782C149.922 12.9067 149.541 13.0057 149.079 13.079V13.321H146.846V12.639L148.023 12.485C148.631 12.4044 149.09 12.298 149.398 12.166C149.706 12.034 149.915 11.8764 150.025 11.693C150.135 11.5024 150.19 11.2934 150.19 11.066C150.19 10.6994 150.083 10.417 149.871 10.219C149.658 10.021 149.324 9.92205 148.87 9.92205H146.846V8.93205ZM146.395 8.93205H147.627V16.137H146.395V8.93205ZM151.917 16.093V16.137H150.366L149.024 14.322C148.87 14.1094 148.73 13.9407 148.606 13.816C148.481 13.684 148.345 13.5887 148.199 13.53C148.052 13.464 147.872 13.42 147.66 13.398C147.447 13.3687 147.176 13.3504 146.846 13.343V13.145H149.079C149.233 13.211 149.368 13.2844 149.486 13.365C149.61 13.4457 149.735 13.5447 149.86 13.662C149.992 13.7794 150.138 13.937 150.3 14.135L151.917 16.093Z"/>
<path d="M153.58 9.57005L153.591 8.93205H154.46L157.584 15.51V16.137H156.704L153.58 9.57005ZM158.024 16.137H156.968L156.88 8.93205H158.024V16.137ZM154.24 16.137H153.096V8.93205H154.152L154.24 16.137Z"/>
<path d="M159.963 8.93205H161.206V16.137H159.963V8.93205ZM160.095 9.96605V8.93205H164.858V9.96605H160.095ZM160.095 16.137V15.103H164.902V16.137H160.095ZM160.095 13.013V11.99H164.374V13.013H160.095Z"/>
<path d="M169.052 15.257C169.543 15.257 169.895 15.1654 170.108 14.982C170.328 14.7987 170.438 14.5457 170.438 14.223C170.438 14.047 170.405 13.8967 170.339 13.772C170.273 13.6474 170.152 13.5337 169.976 13.431C169.807 13.321 169.558 13.2147 169.228 13.112L168.491 12.881C167.846 12.6757 167.38 12.4044 167.094 12.067C166.808 11.7297 166.665 11.3007 166.665 10.78C166.665 10.428 166.76 10.1017 166.951 9.80105C167.142 9.50038 167.428 9.25838 167.809 9.07505C168.19 8.89172 168.663 8.80005 169.228 8.80005C169.631 8.80005 169.998 8.82938 170.328 8.88805C170.665 8.93938 171.039 9.01638 171.45 9.11905L171.274 10.175C170.834 10.0504 170.442 9.96238 170.097 9.91105C169.76 9.85238 169.463 9.82305 169.206 9.82305C168.737 9.82305 168.403 9.90738 168.205 10.076C168.007 10.2374 167.908 10.439 167.908 10.681C167.908 10.857 167.941 11.0147 168.007 11.154C168.073 11.286 168.19 11.407 168.359 11.517C168.535 11.627 168.784 11.7334 169.107 11.836L169.866 12.078C170.526 12.276 170.995 12.5327 171.274 12.848C171.553 13.156 171.692 13.585 171.692 14.135C171.692 14.5604 171.589 14.9344 171.384 15.257C171.179 15.5797 170.878 15.8327 170.482 16.016C170.093 16.1994 169.609 16.291 169.03 16.291C168.627 16.291 168.212 16.247 167.787 16.159C167.362 16.071 166.9 15.9427 166.401 15.774L166.665 14.718C167.156 14.894 167.6 15.0297 167.996 15.125C168.399 15.213 168.751 15.257 169.052 15.257Z"/>
<path d="M175.809 15.257C176.3 15.257 176.652 15.1654 176.865 14.982C177.085 14.7987 177.195 14.5457 177.195 14.223C177.195 14.047 177.162 13.8967 177.096 13.772C177.03 13.6474 176.909 13.5337 176.733 13.431C176.564 13.321 176.315 13.2147 175.985 13.112L175.248 12.881C174.603 12.6757 174.137 12.4044 173.851 12.067C173.565 11.7297 173.422 11.3007 173.422 10.78C173.422 10.428 173.517 10.1017 173.708 9.80105C173.899 9.50038 174.185 9.25838 174.566 9.07505C174.947 8.89172 175.42 8.80005 175.985 8.80005C176.388 8.80005 176.755 8.82938 177.085 8.88805C177.422 8.93938 177.796 9.01638 178.207 9.11905L178.031 10.175C177.591 10.0504 177.199 9.96238 176.854 9.91105C176.517 9.85238 176.22 9.82305 175.963 9.82305C175.494 9.82305 175.16 9.90738 174.962 10.076C174.764 10.2374 174.665 10.439 174.665 10.681C174.665 10.857 174.698 11.0147 174.764 11.154C174.83 11.286 174.947 11.407 175.116 11.517C175.292 11.627 175.541 11.7334 175.864 11.836L176.623 12.078C177.283 12.276 177.752 12.5327 178.031 12.848C178.31 13.156 178.449 13.585 178.449 14.135C178.449 14.5604 178.346 14.9344 178.141 15.257C177.936 15.5797 177.635 15.8327 177.239 16.016C176.85 16.1994 176.366 16.291 175.787 16.291C175.384 16.291 174.969 16.247 174.544 16.159C174.119 16.071 173.657 15.9427 173.158 15.774L173.422 14.718C173.913 14.894 174.357 15.0297 174.753 15.125C175.156 15.213 175.508 15.257 175.809 15.257Z"/>
</g>
<defs><clipPath id="abh-boot-wordmark-badge"><rect width="46" height="14" fill="white" transform="translate(132.348 5.5)"/></clipPath></defs>
</svg>`

/** Create the brand wordmark host: a div carrying the inline wordmark SVG parsed from a static string. */
function wordmark(className: string | undefined): HTMLDivElement {
  const el = div(className)
  const parsed = new DOMParser().parseFromString(BRAND_WORDMARK_SVG, 'image/svg+xml').documentElement
  el.append(parsed)
  return el
}

/** Kernel-owned page mounted below the application's root element. */
export class BootPage {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  private readonly wordmark: HTMLDivElement
  private readonly spinner: HTMLDivElement
  private readonly hint: HTMLDivElement
  private readonly states = new Map<string, LoaderEntryState>()
  private readonly active = new Set<string>()
  private total = 0
  private failure: string | undefined

  /**
   * Build and attach the boot page.
   * @param container - Application mount point.
   */
  constructor(container: HTMLElement) {
    this.root = div(css.boot)
    this.root.dataset.abhBoot = ''
    this.card = div(css.card)
    this.wordmark = wordmark(css.wordmark)
    this.spinner = div(css.spinner)
    this.spinner.dataset.abhBootSpinner = ''
    this.hint = div(css.hint, 'Loading plugins…')
    this.card.append(this.wordmark, this.spinner, this.hint)
    this.root.append(this.card)
    container.append(this.root)
    this.updateProgress()
  }

  /**
   * Set the number of loader entries represented by the progress arc.
   * @param total - Complete boot roster size.
   */
  setTotal(total: number): void {
    this.total = total
    this.updateProgress()
  }

  /**
   * Project one loader entry's fiber state.
   * @param id - Loader entry name.
   * @param state - Projected fiber state.
   */
  setState(id: string, state: LoaderEntryState): void {
    this.states.set(id, state)
    if (state === 'active') this.active.add(id)
    this.updateProgress()
    this.render()
  }

  /**
   * Display the boot failure report.
   * @param message - Failure report text.
   */
  fail(message: string): void {
    this.failure = message
    this.render()
  }

  /** Detach the page before or after the UI renderer takes the mount point. */
  dispose(): void {
    this.root.remove()
  }

  /** Redraw the state-dependent content below the wordmark. */
  private render(): void {
    const failed = [...this.states].filter(([, state]) => state === 'failed').map(([id]) => id)
    if (this.failure === undefined && failed.length === 0) {
      if (this.spinner.parentElement !== this.card) {
        this.card.replaceChildren(this.wordmark, this.spinner, this.hint)
      }
      return
    }
    const report = div(css.failed)
    report.append(div(css.failedTitle, 'Failed to load plugins'))
    for (const id of failed) report.append(div(css.failedItem, id))
    if (this.failure !== undefined) report.append(div(css.failedItem, this.failure))
    this.card.replaceChildren(this.wordmark, report)
  }

  /** Grow the rotating arc monotonically as loader entries activate. */
  private updateProgress(): void {
    const ratio = this.total === 0 ? 0 : Math.min(this.active.size / this.total, 1)
    this.spinner.style.setProperty('--ab-harness-boot-arc', `${String(Math.round(72 + ratio * 216))}deg`)
  }
}
