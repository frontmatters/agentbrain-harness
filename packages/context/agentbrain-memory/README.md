# `@agentbrain-harness/agentbrain-memory`

Optional AgentBrain memory integration for the harness. The plugin uses the shared AgentBrain checkout when its configured `local/` directory exists and otherwise falls back to `<session cwd>/.agentbrain/memories`.

## Plugin

The base bundle mounts this plugin by default. Set `AGENTBRAIN_DIR`, set `AGENTBRAIN_HOME` to its install parent, or configure `agentBrainHome` to select an AgentBrain checkout. Canonical memories are Markdown files under `<agentBrainHome>/local/memories` with AgentBrain frontmatter (`id`, `name`, `description`, and `metadata`). New canonical IDs use the UUID5 namespace from `brain.json` and the path `agentBrain/local/memories/<name>`.

The plugin contributes `memory_save`, `memory_recall`, and `memory_forget`, plus one short system-prompt section. Save and forget use a host-owned writer constrained to the fixed AgentBrain memories directory; they do not turn the general filesystem tool into an external-vault write channel. Recall is case-insensitive term matching and returns newest memories first. Saved content is capped at 20,000 characters and recall returns at most eight entries by default.

## Shared-vault behavior

When AgentBrain is present, every ABH session using the same checkout reads and writes the same `local/memories` directory. Existing canonical notes remain readable, including metadata tags. The write tools refuse to save or forget while AgentBrain's canonical `local/sessions/.incognito` flag exists. When AgentBrain is absent, the workspace-local fallback keeps ABH usable without AgentBrain. The fallback is never copied into the shared vault automatically.

## Model Experience

### Memory tools

#### What the model sees

The `memory_save`, `memory_recall`, and `memory_forget` tools add durable actions and a short prompt section; recalled note bodies are returned only when the model requests them.

#### Token effect

The prompt section is bounded by the plugin's configured limits; recalled content is bounded per item and by the result count.

#### KV Cache effect

A saved or recalled memory changes later model input and may invalidate the provider's prompt cache according to the selected LLM.

## Known Limitations and Deferred Work

- Recall uses substring matching rather than semantic retrieval; AgentBrain semantic retrieval remains an optional future provider.
- `memory_forget` accepts the memory filename/name, not a UUID lookup across renamed notes.
- Command and skill discovery are separate providers; this package does not execute arbitrary vault files.
