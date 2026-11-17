# Element template fixtures

Every template here is hand-written for c8ctl's tests, with made-up IDs,
labels and groups and no text copied from `camunda/connectors`. The REST
templates reuse a few binding names and one condition shape from the Apache
2.0 HTTP connector. Do not add upstream templates: most connector templates
are not under a license compatible with c8ctl's MIT license.

| File                | Template              | Version | Covers                                                                          |
| ------------------- | --------------------- | ------- | ------------------------------------------------------------------------------- |
| `rest-v10.json`     | `io.example.rest`     | 10      | `keepBody`, removed in 17 (lossy update)                                        |
| `rest-v12.json`     | `io.example.rest`     | 12      | adds `skipEmpty`, conditional on `method`                                       |
| `rest-v17.json`     | `io.example.rest`     | 17      | drops `keepBody`, adds `retryOnFailure`                                         |
| `agent-v1-v10.json` | `io.example.agent.v1` | 10      | `provider.type` dropdown with conditional children                              |
| `agent-v1-v11.json` | `io.example.agent.v1` | 11      | adds optional `limits.timeout` (lossless update)                                |
| `agent-v2-v1.json`  | `io.example.agent.v2` | 1       | embedded `metadata.migratesFrom` moving `limits.maxRounds` to `limits.maxSteps` |

Tests that need the real upstream templates fetch them at run time; see
`tests/unit/element-template-migration-upstream-fidelity.test.ts`.
