# Template Migration

A migration applies a target template and carries over stored values:

* **Update** — same template, newer version (`A@n` → `A@m`).
* **Change** — different template (`A` → `B`).

Both apply directly as one command on the host's existing undo stack.

## Scope

Migration transforms stored values. Template builders can use other features for edge cases:

* Invalid or missing values — target property [`constraints`](../src/cloud-element-templates/util/propertyUtil.js#L1222).
* Other manual work (secrets, FEEL, deployment, connector upgrades) — the `changes` field, which hosts can display.

Migration does not manage the full lifecycle:

* Verify completeness or runtime equivalence, or generate a loss report.
* Validate that instructions are complete and effective, or validate across fields ([#323](https://github.com/bpmn-io/bpmn-js-element-templates/issues/323)).
* Resolve and handle dynamic endpoint values derived from FEEL or secrets.
* Enable rollback or recovery of failed migrations.

**When to declare instructions:** declare instructions when stored values need conversion, and `changes` for manual work the host may need to explain. Renamed bindings usually need instructions; new required fields can use target constraints. Renamed labels and changed defaults usually need neither.

## Declaration

Each template declares, in `migratesFrom`, the steps that produce its versions:

```json
"migratesFrom": [
  {
    "sourceTemplateId": "example.rest",
    "minSourceVersion": 1,
    "toVersion": 2,
    "availabilityMessage": "Migration to REST connector is available.",
    "changes": "- URL is now called endpoint.\n- HTTP methods are lower case.",
    "instructions": [
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

### Step

| Field | Meaning |
|---|---|
| `toVersion` | Required, except for legacy entries (see Rules). Version of the declaring template this step produces. |
| `sourceTemplateId` | Source template. Defaults to the declaring template (an Update step). |
| `minSourceVersion`, `maxSourceVersion` | Optional inclusive bounds on the current version. Unversioned counts as `0`. |
| `availabilityMessage` | User-facing message shown when offering the migration. Falls back to the source's `deprecated.message`. |
| `changes` | User-facing changelist and next steps. |
| `instructions` | Ordered instructions. All read the values from before the step, so a step can swap bindings. |

### Instruction

| Field | Meaning |
|---|---|
| `from`, `to` | Copy a value between bindings. Empty sources are skipped. |
| `set` | Write a literal to `to` instead of copying. `set: ""` clears a default. |
| `values` | Remap copied strings, e.g. `{ "GET": "get" }`. |
| `replace` | `{ pattern, replacement }` regex replace on copied strings, after `values`. FEEL expressions are matched and replaced as stored text. |
| `when` | Condition(s), all must match: `{ binding, equals }`, `{ binding, isEmpty }`, or `{ binding, matches, not? }`. `isEmpty` includes missing and empty values; existing property getters can make them indistinguishable. FEEL is matched as text. |
| `instructions` | Group instructions under a shared `when`. |

## Rules

* For an Update, run eligible same-template steps above the source version and through the target version, in ascending order.
* For a versioned Change, run the earliest eligible direct step from the current source template and version, at or before the selected target version. Then run the target's Update steps through the selected version; do not run source Update steps.
* Each step reads the result of the previous step. Intermediate defaults are not applied; versions without Update steps are no-ops.
* Only the source and target templates need to be loaded.
* Instructions and steps are optional. The target template can be applied without value migration.
* Missing or inactive destinations are skipped. Write controlling values before dependent ones.
* Hidden fields always take the target default; migration does not write them. A hidden value that users must edit is a template design problem. Edited fields keep their value; unset or old-default values take the new default.
* Legacy entries with `id` and no `toVersion` still declare a direct, version-agnostic Change.

## Examples

* [REST connector](examples/rest-connector-migrates-from.json) — Update steps for REST v2 versions 1–17 to v18. Versions without instructions are no-ops.
* [AI Agent](examples/ai-agent-migrates-from.json) — Change from AI Agent v1@13 to Sub-process v2@1.

## API

* `elementTemplates.getMigrations(element)` — Change targets
* `elementTemplates.getMigrationAvailabilityMessage(element, template)` — `availabilityMessage` of the first step
* `elementTemplates.getChanges(element, template)` — `changes` of all steps, in order
* `elementTemplates.applyTemplate(element, template)` — apply the migration

Hosts that want to show guidance after applying must capture `getChanges` beforehand; it resolves steps from the element's currently applied template.
