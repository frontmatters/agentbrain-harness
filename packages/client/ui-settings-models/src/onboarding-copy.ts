/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-26.1'

/** The complete editable welcome notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  nl: {
    title: 'Welkom bij agentBrain Harness',
    body: 'agentBrain Harness bevat nu een optionele AgentBrain-integratie voor gedeelde skills, context en geheugen. Zonder AgentBrain blijft ABH zelfstandig werken.\n\nDit is een experimentele release die nog snel verandert. Verwacht ruwe randjes en controleer de installatie voordat je de integratie voor dagelijks werk gebruikt.',
    continueLabel: 'Aan de slag',
  },
  en: {
    title: 'Welcome to agentBrain Harness',
    body: 'agentBrain Harness now includes an optional AgentBrain integration for shared skills, context, and memory. ABH remains standalone when AgentBrain is unavailable.\n\nThis is an experimental release that still changes quickly. Expect rough edges and verify the installation before relying on the integration for daily work.',
    continueLabel: 'Get started',
  },
} as const
