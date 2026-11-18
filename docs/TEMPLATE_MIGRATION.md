# Template Migration (Preliminary)

|  | Upgrade | Migration |
|---|---|---|
| From → to | `A@n` → `A@m` | `A` → `B` |
| Breaking | When user-entered values need migration instructions to be kept | When user-entered values need migration instructions to be kept |
| Values | Kept by binding | Kept by binding, moved as hinted |

## Breaking changes

A template change is **breaking** if keeping the same bindings would lose or misapply a value the user entered, so the target must declare migration instructions. A change that keeps every user-entered value by binding is not breaking, whether or not the template ID changes.

**Mandatory:** preserve user decisions. Every value the user entered on the source must be carried to the target, either unchanged by binding or converted by a migration instruction.

**Not required:** preserve exact behavior. Values the user did not set may take the target's defaults, even if the behavior changes.

A change is breaking, and needs a migration instruction, when the target:

1. Moves or renames the binding of a user-editable value, for example `url` → `endpoint`.
2. Changes the accepted format of a value, for example `POST` → `post`.
3. Splits, merges, or replaces a choice, for example a provider becomes a backend plus an endpoint.
4. Removes a user-editable value or ignores it at its existing binding.

A change is **not breaking** when it only:

* Changes a default, or a hidden or fixed value the user cannot edit.
* Adds a property, including a required one; the user completes it in the properties panel.
* Changes the template ID, name, or description while keeping bindings and formats.

### One-click migration

**Goal:** the user clicks **Update** or **Migrate** and does not have to re-enter or translate anything they configured before.

For every source version it is offered for, a migration must:

* Carry user-entered values to the target where the target accepts them, using the [primitives](#migration-primitives).
* Leave unclear or incomplete target configuration visible for repair after migration.

If a value cannot be converted automatically, preserve it where possible and report a specific action as a lint finding (see [Template-based validation](#template-based-validation-for-edge-cases)). The migration is one undoable command; users can repair the result or undo it.

## Migration primitives

The target template combines two primitives to describe predictable migrations:

| Primitive | Purpose | Example |
|---|---|---|
| Select | Use `when` to choose instructions based on source values. | Select an Anthropic backend from the old endpoint. |
| Transform | Copy or set values with `from`, `to`, `set`, `values`, and `replace`; use `copyEmpty` or `includeHidden` when needed. | Convert a REST method from `post` to `POST`. |

**Scope boundary:** Prefer these primitives and template validation to connector-specific engine features. Propose additional engine behavior only for a general need that cannot be expressed with them. Every known migration action should be automated or visible as a lint finding. If a known case cannot be migrated safely or surfaced as an actionable finding, treat it as a rollout blocker rather than silently changing or dropping data.

## Template-based validation for edge cases

Where conversion cannot safely determine a value, preserve it where possible and use template validation to give the user a precise action. Property constraints check individual fields but skip FEEL expressions; target-level `validation` rules can check multiple bindings and match stored FEEL text. Documentation can explain an action, but should not be its only notification.

For example, a target declaring `backend` and `endpoint` properties could flag a known-invalid public Anthropic endpoint:

```json
{
  "validation": [
    {
      "when": [
        { "binding": { "type": "zeebe:input", "name": "backend" }, "equals": "anthropic-api" },
        { "binding": { "type": "zeebe:input", "name": "endpoint" }, "matches": "^https://api\\.anthropic\\.com/v1/?$" }
      ],
      "property": "endpoint",
      "message": "Remove the trailing /v1; this backend appends /v1/messages."
    }
  ]
}
```

`when` is required: one condition or an AND-array, reading current stored values. `message` is reported when all conditions match. Optional `property` is the target property's ID for Problems-panel navigation; omitted, hidden, or inactive properties produce an element-level finding instead. Conditions must reference declared bindings. Malformed declarations are rejected when templates are loaded. Rules cover authored cases only; they do not prove migration completeness.

Examples of actionable findings include:

* **Known-invalid URL:** remove `/v1` from the public Anthropic endpoint; preserve arbitrary proxy paths.
* **Unresolved configuration:** review a dynamic endpoint or OpenAI-compatible authentication while retaining the original values.
* **External action:** plan the v2 worker and deployment; marking the plan reviewed does not prove deployment.

For unresolved cases, a migration can set a template property to `pending` and a validation rule can report it until the user marks it reviewed. The [AI Agent checks](examples/ai-agent-migration-checks.json) retain these reviews across save, reopen, and later updates. Retain the properties and choices on later target versions. Routine mappings need no review; a review records a decision, not runtime verification.

The host can apply the upgrade once with `elementTemplates.applyTemplate` and report matching rules as errors with `CloudElementTemplatesLinterPlugin`, using the same target definitions. Re-run lint after migration, edits, import, and undo/redo, and make repair or review fields reachable. Lint checks stored text; it cannot resolve expressions, secrets, or external deployment state. Error-level findings alone do not block deployment or execution: the host must enforce a gate if blocking is required.

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

## Composing Select and Transform

Select uses `when`; Transform uses copy, `set`, `values`, and `replace`. `copyEmpty` writes an empty value when the source is missing or empty, and `includeHidden` allows a migration write to a hidden target property. Hidden fields remain controlled by the template author: a later template update can replace a migrated value with the template's default. Editable fields follow normal update behavior: an explicitly changed value is retained, while a value equal to the old default or an absent value may take the new default.

For example, a migration can write to a hidden destination for this migration:

```json
{
  "from": { "type": "zeebe:input", "name": "oldEndpoint" },
  "to": { "type": "zeebe:input", "name": "endpoint" },
  "includeHidden": true
}
```

`elementTemplates.applyTemplate` resolves transformations and applies them as one undoable command. Missing or inactive destinations are skipped; authored `validation` rules can report user-actionable missing or invalid values after the migration. These primitives apply authored instructions, not a completeness or connector-runtime-equivalence check, and do not implement host deployment blocking.

## Connector examples

Attach the example array as the target template's `migratesFrom` and load both templates.

* [REST connector](examples/rest-connector-migrates-from.json): attach to [REST v2@18](https://github.com/camunda/connectors/blob/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/http-json-connector.json) and update from any [published REST v2 version 1–17](https://github.com/camunda/connectors/tree/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/versioned). List only versions that need migration instructions; omitted versions are no-ops. For example, updating v1 to v18 converts lowercase HTTP methods at v3, leaves an unset result expression unset at v13, and keeps the v6 retry backoff at v15.
* [AI Agent](examples/ai-agent-migrates-from.json): migrates [AI Agent v1@13](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-job-worker-13.json) to [AI Agent Sub-process v2@1](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-subprocess-v2-1.json). The recipe accepts only source version 13 (`minSourceVersion` and `maxSourceVersion` are both `13`); other v1 versions are not offered this migration.

For AI Agent, also append the `groups` and `properties` from [the migration checks](examples/ai-agent-migration-checks.json) to the target, and attach its `validation` array. The validation rules report unsupported or missing providers and unresolved action items after migration. Keep their bindings declared in the target; rules can report user configuration problems, not missing template declarations.

The recipe preserves endpoint text; the narrowly guarded replacement above is an illustration, not a blanket `/v1` rewrite. Hidden target endpoints use the template's default on later updates; editable values changed from their old defaults follow normal update retention.

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
