# AI Agent v1@13 → v2 migration

> [!WARNING]
> Review aid for [#324](https://github.com/bpmn-io/bpmn-js-element-templates/pull/324) only. Remove this file before merge.

## 👤 Findings

The local [Sub-process declaration](docs/examples/ai-agent-migrates-from.json) migrates v1@13 to v2@1. The [published c8ctl recipe](https://github.com/camunda/connectors/blob/674790a0e03bcdae2df5f081de15ee9e90fb81b4/connectors/agentic-ai/connector-aiagent/element-templates/agenticai-ai-agent-subprocess.v2.json) targets v2@5 and accepts v1@12 or later; it also differs on Anthropic URL normalization, prompt caching, and custom Vertex endpoints. Findings below describe the local migration.

The [migration implementation](https://github.com/bpmn-io/bpmn-js-element-templates/pull/324) can map stored values, set literals, and normalize stored text. It does not evaluate FEEL or secrets. Compatible same-binding values and defaults also follow normal template-update behavior ([contract](docs/TEMPLATE_MIGRATION.md)).

### Migrates automatically

| Legacy configuration | New provider/backend | Automatic result |
| --- | --- | --- |
| Anthropic | Anthropic / Anthropic API, Microsoft Foundry, or Custom | Selects a backend from the stored endpoint and moves the API key. Removes a trailing `/v1` or `/anthropic/v1` where visible in stored text. The canonical public URL uses Anthropic API; other public-host paths or ports use Custom. |
| AWS Bedrock | AWS Bedrock Converse | Carries over credentials, endpoint, region, model, timeout, and sampling settings. |
| OpenAI | OpenAI / OpenAI API / Chat Completions | Carries over credentials, organization/project IDs, model, timeout, and completion settings. |
| Azure OpenAI | OpenAI / Microsoft Foundry / Chat Completions | Carries over endpoint, credentials, deployment name as model, timeout, and completion settings. |
| OpenAI-compatible | OpenAI / Custom / Chat Completions | Carries over endpoint, headers, query parameters, model, timeout, completion settings, and body properties. Selects API-key authentication when the stored key is non-empty; otherwise selects None. |
| Google Vertex AI | Google Gemini / Vertex AI | Carries over project, region, authentication, model, timeout, and sampling settings. Renames `maxOutputTokens` to `maxTokens`. |
| Shared settings | AI Agent Sub-process | Carries over prompts, memory, limits, events, and response settings. The target template changes; the BPMN element kind does not. |

For Anthropic and Bedrock, the declaration clears v2@1's default-enabled prompt caching, preserving the legacy behavior. Target `notEmpty` constraints flag missing required endpoints or API keys; no duplicate manual check is needed.

Task migration declarations and behavioral tests against generated Task and Sub-process templates belong to [camunda/connectors#10548](https://github.com/camunda/connectors/issues/10548). The remaining local example is illustrative, not proof of generated-template or runtime equivalence.

### Gaps

These are uncommon configurations. The migration's general next step is to run the agent and check the [upgrade guide](https://docs.camunda.io/docs/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-upgrade/) if it does not work as expected.

| Applies when | What does not carry over | What to do |
| --- | --- | --- |
| Vertex AI has a custom endpoint different from the default for its region. | v2 derives the [regional endpoint](https://github.com/camunda/connectors/blob/674790a0e03bcdae2df5f081de15ee9e90fb81b4/connectors/agentic-ai/connector-aiagent/src/main/java/io/camunda/connector/agenticai/aiagent/chatmodel/provider/gemini/GeminiEndpoints.java) and has no supported production override. | Use a runtime HTTP proxy or private DNS for Google APIs; otherwise keep the element on v1. A custom endpoint equal to the regional default needs no change. |
| OpenAI-compatible has both a non-empty API key and an `Authorization` header. | The legacy header takes precedence, but migration selects authentication from the stored API key and keeps the header. | For `Bearer <token>`, move the token without `Bearer ` into API key and remove the header. For other schemes, keep the header and set Authentication to None. |

Endpoint routing uses stored text, not resolved FEEL or secrets. If the endpoint's runtime value selects a different backend than the migration could infer, use the same run-and-check step above.

### Deployment notes

- Make the v2 worker available and deploy a new process version. Existing instances keep using the v1 worker; retain it while they need it.
- For an AI Agent Task, update its separate tools subprocess: add extension property `io.camunda.agenticai.toolContainer=true` and set its multi-instance Output element to `{ id: toolCall._meta.id, name: toolCall._meta.name, content: toolCallResult, completedAt: now() }`. The migration does not edit that subprocess.
- The new templates require Desktop Modeler 5.51.0 or later and Camunda 8.10 or later. c8ctl requires version 4.6.1 or later and an execution platform version of 8.10 or later.

### Sources

- [Pinned v1@13 Sub-process](https://github.com/camunda/connectors/blob/674790a0e03bcdae2df5f081de15ee9e90fb81b4/connectors/agentic-ai/connector-aiagent/element-templates/agenticai-aiagent-job-worker.json), [Task](https://github.com/camunda/connectors/blob/674790a0e03bcdae2df5f081de15ee9e90fb81b4/connectors/agentic-ai/connector-aiagent/element-templates/agenticai-aiagent-outbound-connector.json), and [published v2@5 recipe](https://github.com/camunda/connectors/blob/674790a0e03bcdae2df5f081de15ee9e90fb81b4/connectors/agentic-ai/connector-aiagent/element-templates/agenticai-ai-agent-subprocess.v2.json).
- Pinned [v2@1 Sub-process](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-subprocess-v2-1.json) and [Task](https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-task-v2-1.json) templates.
- Generic [migration tests](test/spec/cloud-element-templates/migration/Migration.spec.js) cover the engine primitives, not connector-specific outcomes.
- [AI Agent upgrade guide](https://docs.camunda.io/docs/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-upgrade/) and [provider documentation](https://docs.camunda.io/docs/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-model-providers/).

## 🤖 Migration facts

```text
local_scope: v1@13 to v2@1; published c8ctl recipe targets v2@5 and differs
automatic: provider/backend mapping; stored-field migration; Anthropic endpoint normalization; legacy prompt-caching behavior
gaps: non-default Vertex endpoint; OpenAI-compatible API key plus Authorization header
manual_task_subprocess_update: toolContainer=true and completedAt output
```
