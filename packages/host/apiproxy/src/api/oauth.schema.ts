/**
 * oauth domain zod schemas (names derived from map keys:
 * oauthStatusRequestSchema / oauthStatusValueSchema / …).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { OAuthStatusView } from './oauth.ts'

/** OAuthStatusView wire schema. */
export const oauthStatusViewSchema = z.object({
  connected: z.boolean(),
  type: z.string().optional(),
}) satisfies z.ZodType<Wire<OAuthStatusView>>

/** oauth.status request payload. */
export const oauthStatusRequestSchema = z.object({
  providerId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'oauth.status'>>>

/** oauth.status response value. */
export const oauthStatusValueSchema = z.object({
  connected: z.boolean(),
  type: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'oauth.status'>>>

/** oauth.logout request payload. */
export const oauthLogoutRequestSchema = z.object({
  providerId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'oauth.logout'>>>

/** oauth.logout response value. */
export const oauthLogoutValueSchema = z.object({}) satisfies z.ZodType<Wire<ResponseValue<'oauth.logout'>>>

/** oauth.begin request payload. */
export const oauthBeginRequestSchema = z.object({
  providerId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'oauth.begin'>>>

/** oauth.begin response value. */
export const oauthBeginValueSchema = z.object({
  authUrl: z.url(),
  code: z.string().min(1).optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'oauth.begin'>>>

/** oauth.providers request payload (none). */
export const oauthProvidersRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'oauth.providers'>>>

/** oauth.providers response value. */
export const oauthProvidersValueSchema = z.object({
  providers: z.array(z.object({ id: z.string().min(1), name: z.string() })),
}) satisfies z.ZodType<Wire<ResponseValue<'oauth.providers'>>>
