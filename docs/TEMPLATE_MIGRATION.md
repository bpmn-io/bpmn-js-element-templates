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
    "id": "example.rest",
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

* `id` — source template, any version.
* `description` — shown where the migration is offered; falls back to the source's `deprecated.message`.
* `changes` — human readable changes (text, markdown, HTML); rendered by the application.
* `properties` — move the value of `from` to `to`, optionally mapping `values`.

## Rules

* Migrations are direct: `C` declares `A` to migrate `A → C`.
* Source and target template must be loaded.
* Migration is a single, undoable template change.

## API

* `elementTemplates.getMigrations(element)` — migration targets
* `elementTemplates.getChanges(element, template)` — authored `changes`
* `elementTemplates.applyTemplate(element, template)` — migrate
* `elementTemplates.reviewChanges` event — fired by the properties panel on _Review changes_
