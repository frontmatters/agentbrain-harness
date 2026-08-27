# `@agentbrain-harness/agentbrain-context`

Optional first-step context integration for AgentBrain. When an AgentBrain checkout is present, the plugin adds canonical rules, shared agent guidance, skills index, lifecycle guidance, preference notes, startup context, and the matching local project notes to the first model request of each session.

## Plugin

The base bundle mounts this plugin with explicit byte limits. It selects `AGENTBRAIN_DIR`, then `$AGENTBRAIN_HOME/agentBrain`, then `~/agentBrain` (with `~/Developer/agentBrain` as fallback), reads only existing files through ABH's filesystem service, and becomes a no-op when the checkout is absent. Project candidates follow AgentBrain's documented project lookup: the Git root name and the session working-directory name are checked under `local/projects/`.

The injected message is a durable, source-attributed plugin message, so model-visible context remains reconstructable from the session log. The plugin consumes only ABH's session and system-prompt services and does not select or depend on an LLM provider. It does not execute AgentBrain scripts or bypass filesystem policy.

## Model Experience

### Session context

#### What the model sees

The `agentbrain-context` plugin adds one bounded, durable context message containing selected AgentBrain guidance and project context to the first model request of a session.

#### Token effect

The configured byte limits bound the context contribution before it reaches the model.

#### KV Cache effect

The first request includes the context contribution; later requests reuse the provider's normal cache behavior.

## Known Limitations and Deferred Work

- Context is loaded once per session; changes made after the first request are picked up by the next session rather than the current one.
- Project discovery uses the Git-root and working-directory names; an explicit project selector is not yet exposed in the ABH profile.
- Semantic memory retrieval remains separate from this static context projection and is provided by `agentbrain-memory`.
