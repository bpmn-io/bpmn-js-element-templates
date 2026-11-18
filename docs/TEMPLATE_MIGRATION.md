# Template Migration (Preliminary)

|  | Upgrade | Migration |
|---|---|---|
| From → to | `A@n` → `A@m` | `A` → `B` |
| Breaking | Never | Possibly; only where `B` declares it |
| Values | Kept by binding | Kept by binding, moved as hinted |

## Declaration

The target template declares its sources:

```json
"migratesFrom": [
  {
    "sourceTemplateId": "example.rest",
    "minSourceVersion": 1,
    "toVersion": 2,
    "description": "Migration to REST connector is available.",
    "changes": "- URL is now called endpoint.\n- HTTP methods are lower case.",
    "properties": [
      {
        "from": { "type": "zeebe:input", "name": "url" },
        "to": { "type": "zeebe:input", "name": "endpoint" }
      },
      {
        "from": { "type": "zeebe:taskHeader", "key": "method" },
        "to": { "type": "zeebe:taskHeader", "key": "method" },
        "values": { "GET": "get", "POST": "post" }
      }
    ]
  }
]
```

* `toVersion` — required for a versioned step. The version on which the step lands.
* `sourceTemplateId` — defaults to the declaring template's ID. Use a different ID for a change step.
* `minSourceVersion` — optional inclusive lower bound checked against the source template version or the landing version of the last applied step (unversioned sources count as `0`).
* `maxSourceVersion` — optional inclusive upper bound, checked the same way. Set both bounds to the same value to accept exactly one source version.
* `description` — shown where the migration is offered; falls back to the source's `deprecated.message`.
* `changes` — human readable changes (text, markdown, HTML); rendered by the application.
* `properties` — ordered instructions. Either copy `from` to `to` (optionally remapping non-empty strings with `values`), write a literal with `to` and `set`, or group instructions in a nested `properties` array.
* `when` — optional on a group or individual instruction. Supply one condition or an array that must all match. Each condition reads a source `binding` and uses `equals` (strict equality), `isEmpty` (`true` for missing, null, or empty string; `false` for present), or `matches` (a JavaScript regular expression string, optionally inverted with `not: true`).
* `copyEmpty: true` — on a copy, write an empty value when the source is missing or empty instead of skipping the instruction. Use this to suppress a destination default; optional inputs and outputs are removed by the normal property setter. Use `set: ""` to clear a target default when there is no corresponding source field.
* `includeHidden: true` — opt in to writing a hidden destination. Inactive destinations are still skipped. Write controlling values before their dependent destinations.
* `replace: { "pattern": "...", "replacement": "..." }` — transform a non-empty copied string after `values` remapping. Uses JavaScript `String.replace` with a regular expression and capture references such as `$1`. FEEL expressions and non-string values are rejected rather than rewritten.
* `require` — on a step, group, or instruction, assert one source condition or an AND-array using the same syntax as `when`. Unlike `when`, an unmet requirement aborts migration with the optional authored `message`. Unselected groups are not checked.
* `required: true` — require a selected write to have a source value (unless `copyEmpty`), a declared destination, hidden-write permission, and an active destination. For a conditional required destination, explicitly write its controllers first; the preflight does not guess values from defaults or existing bindings. Hidden controllers must be persistent inputs/outputs. Intermediate-only bindings cannot be required.

## Composing Select, Transform, Persist, and Require

Select uses `when`; Transform uses copy, `set`, `values`, and `replace`. Persist is a destination **property** option, not a migration instruction: `persist: true` on a `zeebe:input` or `zeebe:output` retains its stored value (including a hidden value, a value equal to the old default, or an absent mapping) on refresh and later updates when the old template has the same binding. Keep the flag on later template versions. New fields still receive their defaults; explicit presets still win. Deactivating a conditional field still removes it normally.

For example, the destination can declare:

```json
{
  "type": "Hidden",
  "value": "",
  "optional": true,
  "persist": true,
  "binding": { "type": "zeebe:input", "name": "endpoint" }
}
```

An authored migration group can then select a known static URL, require a supported shape, remove its known legacy suffix, and require the hidden write:

```json
{
  "when": {
    "binding": { "type": "zeebe:input", "name": "provider.type" },
    "equals": "anthropic"
  },
  "require": {
    "binding": { "type": "zeebe:input", "name": "oldEndpoint" },
    "matches": "^https://api\\.anthropic\\.com/v1/?$"
  },
  "message": "Configure a public Anthropic endpoint before migrating.",
  "properties": [
    {
      "from": { "type": "zeebe:input", "name": "oldEndpoint" },
      "to": { "type": "zeebe:input", "name": "endpoint" },
      "replace": { "pattern": "/v1/?$", "replacement": "" },
      "includeHidden": true,
      "required": true
    }
  ]
}
```

`elementTemplates.applyTemplate` resolves transformations, checks requirements, and preflights required destinations **before entering the command stack**. Authored-check failures leave the original element and undo history unchanged; successful changes remain one undoable operation. This is not a general rollback facility for unexpected modeling errors or direct command-stack calls. Optional writes retain best-effort behavior. These primitives apply authored instructions, not a completeness or connector-runtime-equivalence check, and do not implement host deployment blocking.

## Connector examples

Attach the example array as the target template's `migratesFrom` and load both templates.

* [REST connector](examples/rest-connector-migrates-from.json): attach to [REST v2@18](https://github.com/camunda/connectors/blob/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/http-json-connector.json) and update from any [published REST v2 version 1–17](https://github.com/camunda/connectors/tree/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/versioned). List only versions that need migration instructions; omitted versions are no-ops. For example, updating v1 to v18 converts lowercase HTTP methods at v3, leaves an unset result expression unset at v13, and keeps the v6 retry backoff at v15.
* [AI Agent](examples/ai-agent-migrates-from.json): migrates [AI Agent v1@13](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-job-worker-13.json) to [AI Agent Sub-process v2@1](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-subprocess-v2-1.json). The recipe accepts only source version 13 (`minSourceVersion` and `maxSourceVersion` are both `13`); other v1 versions are not offered this migration.

For AI Agent, also append the `groups` and `properties` from [the migration checks](examples/ai-agent-migration-checks.json) to the target, and attach its `validation` array. The migration requires these declared action-item destinations; it fails before editing if they are missing. These are authored template properties, not engine-owned migration state.

The pinned templates do not declare `persist`. Opt the relevant destination properties into persistence: the public Anthropic and Vertex endpoints, the system prompt, the OpenAI model, and the Anthropic/Bedrock prompt-caching settings. Make the public Anthropic endpoint an editable `String` property with `feel: "optional"` so a reported URL error can be repaired. Keep the existing binding and `persist: true`. The recipe preserves endpoint text; the narrowly guarded replacement above is an illustration, not a blanket `/v1` rewrite.

## One-click upgrade and visible action items

The host can call `applyTemplate` once and run `ElementTemplateLinterPlugin` with the same target definitions. Existing field constraints still report errors. Target-level `validation` adds authored cross-field checks using the same binding conditions as migration `when`:

```json
{
  "validation": [
    {
      "when": [
        { "binding": { "type": "zeebe:input", "name": "backend" }, "equals": "custom" },
        { "binding": { "type": "zeebe:input", "name": "endpoint" }, "matches": "^=" }
      ],
      "property": "endpoint",
      "message": "Configure a supported static endpoint; this backend cannot verify an endpoint expression."
    }
  ]
}
```

`when` is required: one condition or an AND-array, reading current stored values, including FEEL text. `message` is the action to report when all conditions match. Optional `property` is the destination property's ID for Problems-panel navigation; hidden or inactive destinations produce an element-level finding instead. Conditions must reference declared bindings. Malformed declarations are rejected when templates are loaded. This is authored validation, not a completeness checker or an evaluator for expressions/secrets.

The AI example upgrades to the v2 template/job type while preserving inputs. Known-invalid Anthropic suffixes become errors linked to editable endpoint fields; fixing the value clears the error on the next lint run. Nonstandard proxy paths are preserved rather than rewritten. Endpoint expressions/secrets, uncertain proxy paths, and OpenAI-compatible headers/dynamic keys create explicit review action items because their effective behavior cannot be established offline. The action items are stored as ordinary `zeebe:property` Dropdowns, survive save/reopen/update, and are undone/redone with the migration. Retain those fields and their choices on later target versions.

Only unresolved cases require review; routine copied settings do not. Marking an item Reviewed records a human decision, not runtime verification. Deployment always receives a visible action item: plan the v2 worker/optional overrides and a new process deployment while keeping existing v1 instances supported. Reviewing that plan is not evidence that deployment happened.

**Host acceptance contract:** every known migration action is either automated or appears as a lint finding; documentation only elaborates a finding. Re-lint after upgrade, field edits, undo/redo, and import, and make the relevant repair/review field reachable. Static unknowns must remain visible before execution, not only fail at runtime. Error-level findings do not themselves block deployment: the host must enforce a gate if blocking is required. This example is not a guarantee for other source versions, variants, custom runtime implementations, or runtime equivalence.

## Rules

* The target owns the chain. For a same-ID update, run steps above the source version and through the target version in ascending order. For an ID change, take the earliest eligible step for the source ID, then run same-ID steps above its landing version.
* Each step reads the staged values left by previous steps; conditions and copies within a step read the same snapshot. Expressions are not evaluated. Omitted steps do nothing and do not materialize intermediate template defaults.
* Only source and target templates need to be loaded. The engine executes the chain as one undoable template change and writes only bindings active on the final template. Same-ID steps run via **Update**, cross-ID steps via **Migrate**.
* Legacy entries with `id` and no `toVersion` still declare a direct, version-agnostic ID change.

## API

* `elementTemplates.getMigrations(element)` — eligible cross-ID migration targets
* `elementTemplates.getChanges(element, template)` — authored `changes` in step order
* `elementTemplates.applyTemplate(element, template)` — migrate
* `elementTemplates.reviewChanges` event — fired by the properties panel on _Review changes_
