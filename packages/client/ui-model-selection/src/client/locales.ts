/**
 * `model` namespace dictionaries.
 *
 * `trigger.selectAria` reads identically to `trigger.fallback` today and is
 * still a separate key: the visible fallback label and the accessible name of
 * an unset trigger are free to diverge per locale, and folding it into
 * `trigger.aria` would announce the degenerate "Select model, current Select
 * model".
 */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'command.description': 'Selecteer het model voor dit gesprek',
  'option.loadError': 'Catalogus laden mislukt: {message}',
  'trigger.fallback': 'Selecteer model',
  'trigger.selectAria': 'Selecteer model',
  'trigger.aria': 'Selecteer model, huidig {model}',
  'trigger.ariaEffort': 'Selecteer model, huidig {model}, reasoning effort {effort}',
  'menu.aria': 'Model en reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'effort.providerDefault': 'Default',
  'status.loading': 'Modellijst vernieuwen…',
  'error.action': 'Modelbewerking mislukt: {message}',
  'action.reload': 'Opnieuw laden',
  'warning.groupLoad': '{name} laden mislukt: {message}',
  'empty.models': 'Geen modellen beschikbaar.',
  'blocked.composer': 'Dit model is niet beschikbaar — selecteer een model om door te gaan',
  'empty.efforts': 'Dit model biedt geen reasoning effort-niveaus.',
} satisfies Record<string, string>

/** The model namespace key union. */
export type ModelKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'command.description': 'Select the model for this conversation',
  'option.loadError': 'Catalog failed to load: {message}',
  'trigger.fallback': 'Select model',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'effort.providerDefault': 'Default',
  'status.loading': 'Refreshing model list…',
  'error.action': 'Model operation failed: {message}',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'empty.models': 'No models available.',
  'blocked.composer': 'This model is unavailable — select one to continue',
  'empty.efforts': 'This model provides no reasoning effort levels.',
} satisfies Record<ModelKey, string>
