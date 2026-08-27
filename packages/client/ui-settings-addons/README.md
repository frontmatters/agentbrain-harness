# @agentbrain-harness/client-ui-settings-addons

The Web Settings tab for managing AgentBrain addons through the host `agentbrainAddons` Remote namespace (the host package's generated namespace spelling). It consumes `AddonInfo` rows (`id`, `name`, `version`, `state`, and `source`) and exposes the host `list`, `enable`, and `disable` operations through a documented local injected face. The source is presented as a visible **System** or **Local** layer badge; `bundled` remains the wire value for System addons.

## Model Experience

### Settings surface

#### What the model sees

This package has no model-visible effects; it changes only the browser settings surface and calls the host `agentbrainAddons` methods.

#### Token effect

None; the browser settings surface does not change model input.

#### KV Cache effect

None; addon management does not change model requests or their cache inputs.

## Known Limitations and Deferred Work

- Addon metadata and lifecycle policy remain owned by the host Remote; the tab does not install or remove addon files.
