// Minimal test templates projected from the pinned definitions linked in TEMPLATE_MIGRATION.md.
const $schema = 'https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json';
const appliesTo = [ 'bpmn:SubProcess' ];
const elementType = { value: 'bpmn:AdHocSubProcess' };

const provider = 'provider.type';
const anthropicBackend = 'provider.anthropic.backend.type';
const openaiBackend = 'provider.openai.backend.type';
const vertexBackend = 'provider.googleGemini.backend.type';
const openaiAuth = 'provider.openai.backend.custom.authentication.type';
const azureAuth = 'provider.azureOpenAi.authentication.type';
const foundryAuth = 'provider.openai.backend.foundry.authentication.type';
const systemPrompt = 'data.systemPrompt.prompt';

export const source = {
  $schema,
  appliesTo,
  elementType,
  name: 'AI Agent (v1 test fixture)',
  id: 'io.camunda.connectors.agenticai.aiagent.jobworker.v1',
  version: 13,
  properties: [
    { type: 'Hidden', value: 'io.camunda.agenticai:aiagent-job-worker:1', binding: { type: 'zeebe:taskDefinition', property: 'type' } },
    dropdown(provider, [ 'anthropic', 'bedrock', 'openai', 'azureOpenAi', 'openaiCompatible', 'google-vertex-ai' ]),
    input(systemPrompt, { value: '="v1 prompt"' }),
    input('provider.anthropic.endpoint', { optional: true }),
    input('provider.anthropic.authentication.apiKey'),
    input('provider.bedrock.region'),
    input('provider.openai.authentication.apiKey'),
    input('provider.openai.model.model', { value: 'gpt-4o', condition: is(provider, 'openai') }),
    dropdown(azureAuth, [ 'apiKey', 'clientCredentials' ], is(provider, 'azureOpenAi')),
    input('provider.azureOpenAi.authentication.clientId'),
    input('provider.azureOpenAi.model.deploymentName'),
    input('provider.openaiCompatible.authentication.apiKey', { optional: true }),
    input('provider.openaiCompatible.endpoint'),
    input('provider.openaiCompatible.headers', { optional: true }),
    input('provider.openaiCompatible.model.parameters.customParameters'),
    dropdown('provider.googleVertexAi.authentication.type', [ 'serviceAccountCredentials', 'applicationDefaultCredentials' ]),
    input('provider.googleVertexAi.endpoint', { optional: true }),
    input('provider.googleVertexAi.model.parameters.maxOutputTokens')
  ]
};

export const target = {
  $schema,
  appliesTo,
  elementType,
  name: 'AI Agent Sub-process (v2 test fixture)',
  id: 'io.camunda.connectors.agenticai.ai-agent-subprocess.v2',
  version: 1,
  properties: [
    { type: 'Hidden', value: 'io.camunda.agenticai:aiagent:subprocess:2', binding: { type: 'zeebe:taskDefinition', property: 'type' } },
    dropdown(provider, [ 'anthropic', 'bedrock', 'openai', 'google-gemini' ]),
    input(systemPrompt, { value: '="v2 prompt"' }),
    dropdown(anthropicBackend, [ 'anthropic-api', 'foundry', 'custom' ], is(provider, 'anthropic')),
    ...[ 'anthropic', 'foundry', 'custom' ].flatMap(backend => {
      const prefix = `provider.anthropic.backend.${ backend }`;
      const condition = all(is(provider, 'anthropic'), is(anthropicBackend, backend === 'anthropic' ? 'anthropic-api' : backend));

      if (backend === 'anthropic') {
        return [
          input(`${ prefix }.apiKey`, { condition }),
          input(`${ prefix }.endpoint`, { optional: true, condition })
        ];
      }

      const auth = `${ prefix }.authentication.type`;

      return [
        dropdown(auth, backend === 'custom' ? [ 'none', 'apiKey' ] : [ 'apiKey', 'clientCredentials' ], condition),
        input(`${ prefix }.endpoint`, { condition }),
        input(`${ prefix }.authentication.apiKey`, { condition: all(...condition.allMatch, is(auth, 'apiKey')) })
      ];
    }),
    ...[ 'anthropic', 'bedrock' ].map(name => input(`provider.${ name }.model.parameters.promptCaching.enabled`, {
      type: 'Boolean',
      value: true,
      optional: true,
      condition: is(provider, name)
    })),
    input('provider.bedrock.region'),
    dropdown('provider.openai.api.type', [ 'responses', 'completions' ], is(provider, 'openai')),
    dropdown(openaiBackend, [ 'openai-api', 'foundry', 'custom' ], is(provider, 'openai')),
    dropdown(openaiAuth, [ 'none', 'apiKey' ], all(is(provider, 'openai'), is(openaiBackend, 'custom'))),
    dropdown(foundryAuth, [ 'apiKey', 'clientCredentials' ], all(is(provider, 'openai'), is(openaiBackend, 'foundry'))),
    input('provider.openai.model.model', { condition: is(provider, 'openai') }),
    input('provider.openai.backend.openai.apiKey', { condition: all(is(provider, 'openai'), is(openaiBackend, 'openai-api')) }),
    input('provider.openai.backend.foundry.authentication.clientId', { condition: all(is(provider, 'openai'), is(openaiBackend, 'foundry'), is(foundryAuth, 'clientCredentials')) }),
    input('provider.openai.backend.foundry.authentication.apiKey', { condition: all(is(provider, 'openai'), is(openaiBackend, 'foundry'), is(foundryAuth, 'apiKey')) }),
    input('provider.openai.backend.custom.authentication.apiKey', { condition: all(is(provider, 'openai'), is(openaiBackend, 'custom'), is(openaiAuth, 'apiKey')) }),
    ...[ 'endpoint', 'headers', 'bodyProperties' ].map(name => input(`provider.openai.backend.custom.${ name }`, {
      condition: all(is(provider, 'openai'), is(openaiBackend, 'custom'))
    })),
    dropdown(vertexBackend, [ 'google-gemini-api', 'google-vertex-ai' ], is(provider, 'google-gemini')),
    dropdown('provider.googleGemini.backend.googleVertexAi.authentication.type', [ 'serviceAccountCredentials', 'applicationDefaultCredentials' ], all(is(provider, 'google-gemini'), is(vertexBackend, 'google-vertex-ai'))),
    input('provider.googleGemini.model.parameters.maxTokens', { condition: is(provider, 'google-gemini') }),
    input('provider.googleGemini.backend.googleVertexAi.endpoint', {
      type: 'Hidden',
      optional: true,
      condition: all(is(provider, 'google-gemini'), is(vertexBackend, 'google-vertex-ai'))
    })
  ]
};

function dropdown(name, values, condition) {
  return input(name, {
    type: 'Dropdown',
    value: values[0],
    choices: values.map(value => ({ name: value, value })),
    ...(condition && { condition })
  });
}

function input(name, options) {
  return {
    id: name,
    label: name,
    type: 'String',
    binding: { type: 'zeebe:input', name },
    ...options
  };
}

function is(property, equals) {
  return { property, equals };
}

function all(...allMatch) {
  return { allMatch };
}
