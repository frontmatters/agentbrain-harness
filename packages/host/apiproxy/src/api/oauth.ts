/**
 * oauth domain contract: the web face of the OAuth login/logout/status
 * operations. `oauth.status` reports connection state without exposing the
 * stored credential; `oauth.logout` removes it; `oauth.begin` starts the
 * OAuth flow server-side and returns the authorization URL to redirect the
 * user to.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Wire view of one provider's OAuth connection state. */
export interface OAuthStatusView {
  /** Whether a credential is currently stored for this provider. */
  connected: boolean
  /** Credential type when connected (e.g. "oauth"); absent when not connected. */
  type?: string
}

/** Wire view returned by `oauth.begin`: the authorization URL the client must open. */
export interface OAuthBeginView {
  /** The provider's authorization URL; the client must redirect the user here to complete login. */
  authUrl: string
  /** Device code shown by providers that use a device authorization flow. */
  code?: string
  /** Seconds until the device code expires, when the flow reports one. */
  expiresInSeconds?: number
}

/** One connectable account provider surfaced from the host authorization registry. */
export interface OAuthProviderMeta {
  /** The pi-ai provider id (the segment after the scope in its credential key). */
  id: string
  /** The provider's own display name from its metadata (e.g. "OpenAI Codex"). */
  name: string
}

/** Wire view returned by `oauth.providers`: the account logins the deployment can drive. */
export interface OAuthProviderListView {
  /** The oauth-capable providers, in registration order. */
  providers: readonly OAuthProviderMeta[]
}

/** OAuth-domain unary methods (the map keys oauth.* of RpcMethodMap). */
export interface OAuthApi {
  /**
   * List the account-login providers the deployment can drive, filtered to
   * those offering an OAuth sign-in flow. The client renders these; display
   * names and logos come from client config, so no vendor name is fixed here.
   * @param request - no payload.
   * @returns the oauth-capable providers with their metadata names.
   */
  providers(request: RpcRequest<Record<string, never>>): Promise<RpcResponse<OAuthProviderListView>>

  /**
   * Report whether a provider is connected, without exposing the stored
   * credential value.
   * @param request - carries `providerId`, the pi-ai provider id.
   * @returns connected state and credential type when connected.
   */
  status(request: RpcRequest<{ providerId: string }>): Promise<RpcResponse<OAuthStatusView>>

  /**
   * Remove the stored credential for a provider (disconnect / log out).
   * @param request - carries `providerId`, the pi-ai provider id.
   */
  logout(request: RpcRequest<{ providerId: string }>): Promise<RpcResponse<{}>>

  /**
   * Start the OAuth login flow for a provider. The login runs server-side;
   * this method returns once the provider emits the authorization URL, which
   * the client must open to let the user grant access. After the user
   * completes the flow the credential lands in the store; `oauth.status`
   * reflects it on the next poll.
   * @param request - carries `providerId`, the pi-ai provider id.
   * @returns the authorization URL to redirect the user to.
   */
  begin(request: RpcRequest<{ providerId: string }>): Promise<RpcResponse<OAuthBeginView>>
}
