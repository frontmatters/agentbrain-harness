# @agentbrain-harness/host-agentbrain-addons

Host-only Typert Remote gateway for the canonical `scripts/addons.sh` manager. `list` discovers addon manifests and local enablement state, ignores unrelated filesystem entries, and prefers a local manifest over a bundled duplicate; `check` runs the manifest health probe; `test` runs the declared addon test suite; `enable` and `disable` pass one strictly validated addon id as a fixed `execFile` argument. The manager remains the authority for registry selection, enablement state, and scheduled-job cleanup.

Every command uses `/bin/bash` without a shell, a five-second timeout, and a 256 KiB output bound. The script is resolved from the checkout selected by `@agentbrain-harness/home-paths` (`AGENTBRAIN_DIR`, configured aliases, or the standard checkout locations).

## Generated Remote runtime

The generated `./remote` face contains runtime Zod schemas, so `zod` is a production dependency even though the handwritten `src` files do not import it directly. This keeps the Host package consumable on its own and lets browser assemblies inline the generated schemas safely.

## Model Experience

### Host operations

#### What the model sees

This Host-only gateway adds no prompt, tool, message, or provider request; its `agentbrainAddons` methods do not assemble model instructions.

#### Token effect

None; this package never assembles model input.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **macOS/Linux command path** — phase 1 invokes `/bin/bash`; Windows-native addon management is deferred.
- **External test output** — `test` returns bounded textual diagnostics from the addon's declared suite; it does not silently classify a failure as an unsupported client.
