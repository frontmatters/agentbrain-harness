/** `job` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'job'

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'count.live.one': '{count} achtergrond-job actief',
  'count.live.other': '{count} achtergrond-jobs actief',
  'count.idle.one': '{count} achtergrond-job',
  'count.idle.other': '{count} achtergrond-jobs',
  'list.aria': 'Achtergrond-jobs',
  'status.running': 'actief',
  'status.stopping': 'wordt gestopt',
  'status.completed': 'voltooid',
  'status.killed': 'geannuleerd',
  'status.failed': 'mislukt',
  'duration.seconds': '{seconds}s',
  'duration.minutes': '{minutes}m {seconds}s',
  'duration.hours': '{hours}u {minutes}m',
  'duration.title.live': 'Actief voor {duration}',
  'duration.title.done': 'Duurde {duration}',
} as const

/** English dictionary, key-identical to the Dutch source of truth. */
export const en: Record<JobKey, string> = {
  'count.live.one': '{count} background job running',
  'count.live.other': '{count} background jobs running',
  'count.idle.one': '{count} background job',
  'count.idle.other': '{count} background jobs',
  'list.aria': 'Background jobs',
  'status.running': 'running',
  'status.stopping': 'stopping',
  'status.completed': 'completed',
  'status.killed': 'cancelled',
  'status.failed': 'failed',
  'duration.seconds': '{seconds}s',
  'duration.minutes': '{minutes}m {seconds}s',
  'duration.hours': '{hours}h {minutes}m',
  'duration.title.live': 'Running for {duration}',
  'duration.title.done': 'Took {duration}',
}

/** Key domain of the `job` namespace (nl is the source of truth). */
export type JobKey = keyof typeof nl
