# @agentbrain-harness/provider-overlay

Ships default display metadata for the account-login providers as composition data. The Models page and first-run onboarding read the `ui-provider-overlay` settings section this plugin seeds and render each provider's name, logo, order, and visibility over the engine's own provider name. The engine reports provider names such as `OpenAI Codex`, `Anthropic`, `xAI`, `GitHub Copilot`, `Kimi For Coding`, and `OpenRouter`; the overlay supplies the product display names and pins their order and brand marks.

No vendor name lives in this package's code. The defaults arrive through `config.providers` from the bundle patch, so the marketing names and logo ids are overridable data, not source. The plugin registers the section with those defaults as its base layer; a mounted settings provider layers the user's `ui-provider-overlay` section over it, so the user can rename, reorder, hide, or set a logo for any provider id.

The section is keyed by provider id (the same id the sign-in flow and catalog route use). Each entry is `{ displayName?, logo?, order?, hidden? }`; every field is optional, and a provider absent from the overlay keeps its engine name, carries no logo (a monogram renders), and sorts after the ordered ones.

## Known Limitations and Deferred Work

- The plugin only seeds and validates the section; it exposes no host-side service, because the sole consumer is the web client reading over the wire.
- Brand marks are limited to the ids the client bundles (`openai`, `anthropic`, `xai`, `github`, `kimi`, `openrouter`); an overlay `logo` naming any other id falls back to a monogram.
