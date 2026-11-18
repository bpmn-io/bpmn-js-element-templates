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
* `description` — shown where the migration is offered; falls back to the source's `deprecated.message`.
* `changes` — human readable changes (text, markdown, HTML); rendered by the application.
* `properties` — ordered instructions. Either copy `from` to `to` (optionally remapping non-empty strings with `values`), write a literal with `to` and `set`, or group instructions in a nested `properties` array.
* `when` — optional on a group or individual instruction. Supply one condition or an array that must all match. Each condition reads a source `binding` and uses `equals` (strict equality), `isEmpty` (`true` for missing, null, or empty string; `false` for present), or `matches` (a JavaScript regular expression string, optionally inverted with `not: true`).
* `copyEmpty: true` — on a copy, write an empty value when the source is missing or empty instead of skipping the instruction. Use this to suppress a destination default; optional inputs and outputs are removed by the normal property setter. Use `set: ""` to clear a target default when there is no corresponding source field.
* `includeHidden: true` — opt in to writing a hidden destination. Inactive destinations are still skipped. Write controlling values before their dependent destinations.

## Connector examples

Attach the example array as the target template's `migratesFrom` and load both templates.

* [REST connector](examples/rest-connector-migrates-from.json): attach to [REST v2@18](https://github.com/camunda/connectors/blob/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/http-json-connector.json) and update from any [published REST v2 version 1–17](https://github.com/camunda/connectors/tree/afd91b17524e818219b15581ce3247ca706ad625/connectors/http/rest/element-templates/versioned). The recipe records each published landing version; the pinned catalog does not contain v9. Releases without authored transformations are no-ops. For example, updating v1 to v18 converts lowercase HTTP methods at v3, leaves an unset result expression unset at v13, and keeps the v6 retry backoff at v15.
* [AI Agent](examples/ai-agent-migrates-from.json): migrates [AI Agent v1@13](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-job-worker-13.json) to [AI Agent Sub-process v2@1](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-subprocess-v2-1.json). The recipe excludes source versions below 13. It has no upper bound; only v13 is covered by this example.

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
