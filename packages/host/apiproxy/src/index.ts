/**
 * @agentbrain-harness/host-apiproxy — the API gateway every client shape shares:
 * the ApiProxy contract (api/: types + zod schemas, browser-safe), the fetch
 * carrier pair (fetch/: toFetchHandler on the host side, AbstractApiClient +
 * platform subclasses on the client side), and the host-side implementation
 * (api-proxy.ts: createApiProxy + the ApiProxyService gateway plugin providing
 * `ctx.apiProxy`). Transport-agnostic by design: this package registers no
 * routes — physical carriers wrap `ctx.apiProxy` themselves.
 *
 * The gateway consumes `ctx.agentDefaultModel`, the transport-independent default
 * shared with direct entry points. Switching models persists through that
 * service; sessions that have already logged a selection remain unchanged.
 */

import { Context, Service } from '@agentbrain-harness/cordis'
import z from '@agentbrain-harness/schemastery'
import type {} from '@agentbrain-harness/agent-default-model'
import type {} from '@agentbrain-harness/authorization'
import type {} from '@agentbrain-harness/credentials'
import type { ApiProxy } from './api/index.ts'
import { createApiProxy, DEFAULT_COLD_BLANK_PROBE_MAX_BYTES } from './api-proxy.ts'
import type { OAuthLoginServiceFace } from './api-proxy.ts'
import {
  DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,
  type SessionLogCompressionLevel,
} from './session-export.ts'

export type * from './api/index.ts'
export { RpcId } from './api/rpc.ts'
export { toFetchHandler } from './fetch/handler.ts'
export { AbstractApiClient, InProcessApiClient } from './fetch/client.ts'
export type { IApiClient } from './fetch/client.ts'
export { createApiProxy } from './api-proxy.ts'
export type { ApiProxyDefaults } from './api-proxy.ts'

declare module '@agentbrain-harness/cordis' {
  interface Context {
    /** The host-side ApiProxy implementation (the transport-agnostic gateway face). */
    apiProxy: ApiProxy
  }
}

/** Gateway plugin configuration. */
export interface Config {
  /**
   * Whether this deployment can hand paths to a native desktop opener —
   * the `hasDocument` capability the agent-preset roster reports. Absent,
   * the platform is asked (macOS/Windows/WSL yes; Linux only with a display
   * server); set it explicitly where detection misleads, e.g. `false` in a
   * container whose DISPLAY points nowhere a user can see.
   */
  nativeOpen?: boolean
  /**
   * DEFLATE level for every session-log ZIP entry: `0` stores without
   * compression, `1` favors CPU/latency, and `9` favors archive size.
   * @default 6
   */
  sessionExportCompressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  /**
   * Maximum physical size of a cold Session artifact eligible for blankness
   * verification. Zero disables probes.
   * @default 1024
   */
  coldBlankProbeMaxBytes?: number
}

/**
 * Build the OAuth login face for the web `oauth.*` wire. It bridges to the host
 * authorization seam (upstream's sign-in, which ships no web surface of its
 * own): `begin` runs the provider's authorization flow and relays its auth_url
 * notice + method prompts; `status`/`logout` read and clear the durable
 * credential record. A credential key is "<scope>/<id>" and a login flow
 * registers under a key whose id segment is the provider id (llm-pi-ai's
 * recordKeyFor), so the flow is matched by that id and this gateway stays
 * decoupled from any adapter.
 *
 * The authorization and credentials seams resolve at call time, not
 * construction time: the api-proxy mounts before those base services in the web
 * composition, so an apply-time `ctx.get` would miss them and leave every
 * sign-in reporting "service absent". By the time a user clicks Connect both are
 * mounted; when they are genuinely absent, `begin` rejects with an actionable
 * error and `status`/`logout` treat the provider as not connected.
 * @param ctx - the plugin context carrying the optional authorization and credentials seams.
 * @returns the login face consumed by the api-proxy oauth methods.
 */
export function createOAuthLoginService(ctx: Context): OAuthLoginServiceFace {
  // Resolve both seams together at call time; a provider key is matched by the
  // id segment of its "<scope>/<id>" credential key.
  const seam = (providerId: string) => {
    const auth = ctx.get('authorization')
    const creds = ctx.get('credentials')
    if (auth === undefined || creds === undefined) return undefined
    const key = auth.list().find(entry => entry.key.slice(entry.key.indexOf('/') + 1) === providerId)?.key
    return { auth, creds, key }
  }
  return {
    providers: () => {
      const auth = ctx.get('authorization')
      if (auth === undefined) return []
      // Only flows offering an oauth method are connectable through this wire;
      // list() also carries api-key-only flows. Names come from the provider
      // metadata (entry.label), never from a vendor list in this code.
      return auth.list()
        .filter(entry => entry.methods.some(method => method.id === 'oauth'))
        .map(entry => ({ id: entry.key.slice(entry.key.indexOf('/') + 1), name: entry.label }))
    },
    begin: (providerId, interaction) => {
      const resolved = seam(providerId)
      if (resolved === undefined) {
        return Promise.reject(new Error('oauth: authorization and credentials seams are not mounted'))
      }
      if (resolved.key === undefined) {
        return Promise.reject(new Error(`no authorization flow is registered for provider "${providerId}"`))
      }
      return resolved.auth.begin({
        key: resolved.key,
        method: 'oauth',
        interaction: {
          notify: (notice) => {
            interaction.notify(
              notice.url === undefined
                ? { type: 'info' }
                : { type: notice.code === undefined ? 'auth_url' : 'device_code', url: notice.url, ...notice.code === undefined ? {} : { code: notice.code } })
          },
          prompt: prompt => interaction.prompt({
            type: prompt.kind,
            ...'options' in prompt ? { options: prompt.options } : {},
            ...prompt.signal === undefined ? {} : { signal: prompt.signal },
          }),
        },
      }).then(() => undefined)
    },
    status: async (providerId) => {
      const resolved = seam(providerId)
      if (resolved?.key === undefined) return { connected: false }
      const record = await resolved.creds.readRecord(resolved.key)
      return record === undefined ? { connected: false } : { connected: true, type: record.kind }
    },
    logout: async (providerId) => {
      const resolved = seam(providerId)
      if (resolved?.key !== undefined) await resolved.creds.deleteRecord(resolved.key)
    },
  }
}

/**
 * The API gateway service: implements the ApiProxy contract over the composed
 * host context and provides it as `ctx.apiProxy`. The Host cwd is the default
 * project directory.
 */
export class ApiProxyService extends Service implements ApiProxy {
  static inject = [
    'agentDefaultModel', 'agents', 'attachments', 'directoryPicker', 'llm', 'sessions', 'subagents', 'sessionQuery',
    'tools', 'userQuestions', 'workspaceRegistry',
  ]

  static Config: z<Config> = z.object({
    nativeOpen: z.boolean(),
    sessionExportCompressionLevel: z.number().step(1).min(0).max(9)
      .default(DEFAULT_SESSION_LOG_COMPRESSION_LEVEL) as z<SessionLogCompressionLevel>,
    coldBlankProbeMaxBytes: z.natural().default(DEFAULT_COLD_BLANK_PROBE_MAX_BYTES),
  })

  readonly sessions: ApiProxy['sessions']
  readonly subagents: ApiProxy['subagents']
  readonly workspace: ApiProxy['workspace']
  readonly host: ApiProxy['host']
  readonly goals: ApiProxy['goals']
  readonly skills: ApiProxy['skills']
  readonly agentPresets: ApiProxy['agentPresets']
  readonly settings: ApiProxy['settings']
  readonly credentials: ApiProxy['credentials']
  readonly oauth: ApiProxy['oauth']
  readonly llm: ApiProxy['llm']
  readonly events: ApiProxy['events']
  readonly downloads: ApiProxy['downloads']
  readonly respond: ApiProxy['respond']

  constructor(ctx: Context, config: Config) {
    super(ctx, 'apiProxy')
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ctx.agentDefaultModel.currentSelection(),
      saveDefaultModelSelection: selection => ctx.agentDefaultModel.saveSelection(selection),
      cwd: process.cwd(),
      loginService: createOAuthLoginService(ctx),
      ...config.nativeOpen === undefined ? {} : { canOpenPath: () => config.nativeOpen as boolean },
      ...(config.sessionExportCompressionLevel === undefined
        ? {}
        : { sessionExportCompressionLevel: config.sessionExportCompressionLevel }),
      ...(config.coldBlankProbeMaxBytes === undefined
        ? {}
        : { coldBlankProbeMaxBytes: config.coldBlankProbeMaxBytes }),
    })
    this.sessions = api.sessions
    this.subagents = api.subagents
    this.workspace = api.workspace
    this.host = api.host
    this.goals = api.goals
    this.skills = api.skills
    this.agentPresets = api.agentPresets
    this.settings = api.settings
    this.credentials = api.credentials
    this.oauth = api.oauth
    this.llm = api.llm
    this.events = api.events
    this.downloads = api.downloads
    // createApiProxy returns closures (no `this` capture), so the bind is
    // behavior-neutral.
    this.respond = api.respond.bind(api)
  }
}

export default ApiProxyService
