# Template Migration

A migration applies a target template and carries over stored values:

* **Update** — same template, newer version (`A@n` → `A@m`).
* **Change** — different template (`A` → `B`).

Both apply directly as one command on the host's existing undo stack.

## Scope

Migration transforms stored values. Template builders can use other features for edge cases:

* Invalid or missing values — target property [`constraints`](../src/cloud-element-templates/util/propertyUtil.js#L1222).
* Other manual work (secrets, FEEL, deployment, connector upgrades) — the `changes` field, which hosts can display. Do not list actions already covered by target property constraints.

Migration does not manage the full lifecycle. It does not:

* Verify completeness or runtime equivalence, or generate a loss report.
* Validate that instructions are complete and effective, or validate across fields ([#323](https://github.com/bpmn-io/bpmn-js-element-templates/issues/323)).
* Resolve and handle dynamic endpoint values derived from FEEL or secrets.
* Enable rollback or recovery of failed migrations.

**When to declare instructions:** declare instructions when stored values need conversion, and `changes` for manual work the host may need to explain. Renamed bindings usually need instructions; new required fields can use target constraints. Renamed labels and changed defaults usually need neither.

## Declaration

Each template declares, in `migratesFrom`, how to migrate to it:

```json
{
  "migratesFrom" : [ {
    "sourceTemplateId" : "example.rest",
    "minSourceVersion" : 1,
    "toVersion" : 2,
    "availabilityMessage" : "Migration to REST connector is available.",
    "changes" : "- URL is now called endpoint.\n- HTTP methods are lower case.",
    "instructions" : [ {
      "from" : {
        "type" : "zeebe:input",
        "name" : "url"
      },
      "to" : {
        "type" : "zeebe:input",
        "name" : "endpoint"
      }
    }, {
      "from" : {
        "type" : "zeebe:taskHeader",
        "key" : "method"
      },
      "to" : {
        "type" : "zeebe:taskHeader",
        "key" : "method"
      },
      "values" : {
        "GET" : "get",
        "POST" : "post"
      }
    } ]
  } ]
}
```

### Fields

| Field | Meaning |
|---|---|
| `toVersion` | Required positive integer. Version of the declaring template this step produces. |
| `sourceTemplateId` | Source template. Defaults to the declaring template (an Update step). |
| `minSourceVersion`, `maxSourceVersion` | Optional inclusive bounds on the current version. Unversioned counts as `0`. |
| `availabilityMessage` | User-facing message shown when offering the migration. Falls back to the source's `deprecated.message`. |
| `changes` | User-facing changelist and next steps. |
| `instructions` | Ordered instructions. All instructions and conditions read values from before the step, so a step can swap bindings. |

### Instruction

| Field | Meaning |
|---|---|
| `from`, `to` | Copy a value between bindings. Empty sources are skipped. |
| `set` | Write a literal to `to` instead of copying. `set: ""` clears a default. |
| `values` | Remap copied strings, e.g. `{ "GET": "get" }`. |
| `replace` | `{ pattern, replacement }` regex replace on copied strings, after `values`. FEEL expressions are matched and replaced as stored text. |
| `when` | Condition(s), all must match: `{ binding, equals }`, `{ binding, isEmpty }`, or `{ binding, matches, not? }`. `isEmpty: true` matches missing and empty values; `false` matches non-empty values. Some getters return an empty string for a missing value, so the two cannot always be distinguished. FEEL is matched as text. |
| `instructions` | Group instructions under a shared `when`. |

## Rules

### Select and run steps

* **Update:** Run eligible same-template steps after the source version through the target version, in order. For example, `A@1 → A@3` may run steps for `A@2` and `A@3`.
* **Change:** Run the earliest eligible direct step that lands at or before the target version, then eligible target Update steps. For example, `A@1 → B@3` may run `A@1 → B@2 → B@3`. It skips Updates to `A`.
* **Between steps:** Each step reads the previous step's writes. Defaults are not applied between steps; versions without an Update step are skipped.
* **Within a step:** Instructions read the same pre-step values. Apply writes in order; an earlier write can activate a later destination. Skip writes to missing or inactive destinations.

### Apply the target template

* **Availability:** Only the source and target templates need to be loaded. For example, an `A@1` to `B@2` change does not require `A@2` to be loaded.
* **Optional migration:** Steps and instructions may be omitted; normal template-update behavior still applies.
* **Hidden fields:** They take the target default; migration cannot write them. If users need to edit a hidden value, change the target template.
* **Other fields:** Without a migration write, normal template-update behavior determines whether to keep the existing value or use the target default.

## Examples

These migration examples show coverage and the user experience of reviewing migration instructions. They follow `connectors` repository patterns.

* [REST connector](examples/rest-connector-migrates-from.json) — Update steps for REST v2 versions 1–17 to v18. Versions without instructions are no-ops.
* [AI Agent Sub-process](examples/ai-agent-migrates-from.json) — Change from v1@13 to v2@1.

These are illustrative declarations. Tests here cover migration primitives; tests of generated connector templates belong in `connectors`.

## API

* `elementTemplates.getMigrations(element)` — Change targets as `{ template, availabilityMessage, changes }` entries. The message comes from the first migration step, falling back to the source template's `deprecated.message`. `changes` combines authored guidance from all applicable steps, in order.
* `elementTemplates.getChanges(element, template)` — authored `changes` from all applicable steps, in order, including same-template Updates that are not returned by `getMigrations`.
* `elementTemplates.applyTemplate(element, template)` — apply the migration.
* `elementTemplates.reviewChanges` event — fired with `{ element, newTemplate, changes }` when the user selects _Review changes_ in the properties panel. The entry is shown only when a migration has `changes`.

The migration list and `getChanges` resolve steps from the element's currently applied template. Hosts can review `changes` before applying; the existing `elementTemplates.apply` and `elementTemplates.update` events also include it when available.
