import { expect } from 'chai';

import Modeler from 'bpmn-js/lib/Modeler';
import ZeebeBehaviors from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import zeebe from 'zeebe-bpmn-moddle/resources/zeebe.json';

import elementTemplatesModule from 'src/cloud-element-templates/core';
import { findExtension, findInputParameter } from 'src/cloud-element-templates/Helper';
import { setPropertyValue } from 'src/cloud-element-templates/util/propertyUtil';
import declaration from 'docs/examples/ai-agent-task-migrates-from.json';

import diagramXML from './diagram.bpmn';
import { source as subProcessSource, target as subProcessTarget } from './aiAgentTemplates';


// Task bindings projected from the v1@13 and v2@1 connector templates:
// https://github.com/camunda/connectors/blob/6b51fe8fe6ace2fddeb7c581079772732274234d/connectors/agentic-ai/connector-aiagent/element-templates/agenticai-aiagent-outbound-connector.json
// https://github.com/camunda/modeler-prototypes/blob/69c2733c23645634e3f665bc403f589af621f741/src/templates/ai-agent-task-v2-1.json
const taskType = {
  appliesTo: [ 'bpmn:Task' ],
  elementType: { value: 'bpmn:ServiceTask' }
};

const agentDefinition = {
  type: 'Hidden',
  value: 'aiAgentTask',
  binding: { type: 'zeebe:agentDefinition', property: 'agentType' }
};

const tools = [ 'containerElementId', 'toolCallResults' ].map((name, index) => ({
  id: `data.tools.${ name }`,
  label: name,
  type: index ? 'Text' : 'String',
  optional: true,
  binding: { type: 'zeebe:input', name: `data.tools.${ name }` }
}));

function taskProperties(properties, workerType) {
  return [
    { type: 'Hidden', value: workerType, binding: { type: 'zeebe:taskDefinition', property: 'type' } },
    agentDefinition,
    ...properties.filter(property => property.binding.type !== 'zeebe:taskDefinition'),
    ...tools
  ];
}

const source = {
  ...subProcessSource,
  ...taskType,
  name: 'AI Agent Task (v1 test fixture)',
  id: 'io.camunda.connectors.agenticai.aiagent.v1',
  properties: taskProperties(subProcessSource.properties, 'io.camunda.agenticai:aiagent:1')
};

const target = {
  ...subProcessTarget,
  ...taskType,
  name: 'AI Agent Task (v2 test fixture)',
  id: 'io.camunda.connectors.agenticai.ai-agent-task.v2',
  properties: taskProperties(subProcessTarget.properties, 'io.camunda.agenticai:aiagent:task:2'),
  migratesFrom: declaration
};


describe('migration - AI Agent Task v1@13 to Task v2@1', function() {

  let modeler, elementTemplates, element;

  beforeEach(async function() {
    modeler = new Modeler({
      additionalModules: [ ZeebeBehaviors, elementTemplatesModule ],
      moddleExtensions: { zeebe },
      elementTemplates: [ source, target ]
    });

    await modeler.importXML(diagramXML);

    elementTemplates = modeler.get('elementTemplates');
    const [ loadedSource ] = elementTemplates.getAll(source.id);

    expect(loadedSource).to.exist;
    element = elementTemplates.applyTemplate(modeler.get('elementRegistry').get('Legacy'), loadedSource);
  });

  afterEach(function() {
    modeler.destroy();
  });


  for (const version of [ 12, 13, 14 ]) {
    it(`should ${ version === 13 ? '' : 'not ' }offer migration from Task v1@${ version }`, function() {
      const versioned = { ...source, version };

      elementTemplates.set([ versioned, target ]);
      elementTemplates.applyTemplate(element, versioned);
      element = modeler.get('elementRegistry').get(element.id);

      expect(elementTemplates.getMigrations(element)).to.eql(version === 13 ? [
        {
          template: target,
          availabilityMessage: declaration[0].availabilityMessage,
          changes: declaration[0].changes
        }
      ] : []);
    });
  }


  it('should retain tool integration on the service task through undo, redo, and reload', async function() {
    write('data.tools.containerElementId', 'ToolContainer');
    write('data.tools.toolCallResults', '=toolResults');
    const originalPrompt = read('data.systemPrompt.prompt');

    migrate();

    expect(element.businessObject.$type).to.equal('bpmn:ServiceTask');
    expect(findExtension(element, 'zeebe:TaskDefinition').get('type')).to.equal('io.camunda.agenticai:aiagent:task:2');
    expect(findExtension(element, 'zeebe:AgentDefinition').get('agentType')).to.equal('aiAgentTask');
    expect(read('data.tools.containerElementId')).to.equal('ToolContainer');
    expect(read('data.tools.toolCallResults')).to.equal('=toolResults');
    expect(read('data.systemPrompt.prompt')).to.equal(originalPrompt);

    const commandStack = modeler.get('commandStack');
    commandStack.undo();
    expect(elementTemplates.get(element).id).to.equal(source.id);
    expect(findExtension(element, 'zeebe:TaskDefinition').get('type')).to.equal('io.camunda.agenticai:aiagent:1');
    expect(read('data.tools.toolCallResults')).to.equal('=toolResults');

    commandStack.redo();
    expect(elementTemplates.get(element).id).to.equal(target.id);

    await modeler.importXML((await modeler.saveXML()).xml);
    element = modeler.get('elementRegistry').get(element.id);
    expect(read('data.tools.containerElementId')).to.equal('ToolContainer');
    expect(read('data.tools.toolCallResults')).to.equal('=toolResults');
    expect(findExtension(element, 'zeebe:AgentDefinition').get('agentType')).to.equal('aiAgentTask');
  });


  it('should map OpenAI-compatible settings and keep tool values', function() {
    write('provider.type', 'openaiCompatible');
    write('provider.openaiCompatible.authentication.apiKey', '=apiKey');
    write('provider.openaiCompatible.endpoint', 'https://proxy.example');
    write('provider.openaiCompatible.model.parameters.customParameters', '={ seed: 1 }');
    write('data.tools.containerElementId', 'ToolContainer');

    migrate();

    expect(read('provider.type')).to.equal('openai');
    expect(read('provider.openai.api.type')).to.equal('completions');
    expect(read('provider.openai.backend.type')).to.equal('custom');
    expect(read('provider.openai.backend.custom.authentication.type')).to.equal('apiKey');
    expect(read('provider.openai.backend.custom.authentication.apiKey')).to.equal('=apiKey');
    expect(read('provider.openai.backend.custom.endpoint')).to.equal('https://proxy.example');
    expect(read('provider.openai.backend.custom.bodyProperties')).to.equal('={ seed: 1 }');
    expect(read('data.tools.containerElementId')).to.equal('ToolContainer');
  });


  it('should select Foundry for an Anthropic endpoint without enabling prompt caching', function() {
    write('provider.anthropic.endpoint', 'https://resource.services.ai.azure.com/anthropic/v1');
    write('provider.anthropic.authentication.apiKey', '=apiKey');

    migrate();

    expect(read('provider.anthropic.backend.type')).to.equal('foundry');
    expect(read('provider.anthropic.backend.foundry.endpoint')).to.equal('https://resource.services.ai.azure.com');
    expect(read('provider.anthropic.backend.foundry.authentication.apiKey')).to.equal('=apiKey');
    expect(read('provider.anthropic.model.parameters.promptCaching.enabled')).to.be.undefined;
  });

  it('should keep a non-canonical public Anthropic endpoint on the custom backend', function() {
    write('provider.anthropic.endpoint', 'https://api.anthropic.com:8443/v1');

    migrate();

    expect(read('provider.anthropic.backend.type')).to.equal('custom');
    expect(read('provider.anthropic.backend.custom.endpoint')).to.equal('https://api.anthropic.com:8443');
  });

  it('should remove a literal FEEL endpoint suffix without evaluating it', function() {
    write('provider.anthropic.endpoint', '=endpoint + "/v1"');

    migrate();

    expect(read('provider.anthropic.backend.type')).to.equal('custom');
    expect(read('provider.anthropic.backend.custom.endpoint')).to.equal('=endpoint');
  });


  it('should use the hidden public Anthropic endpoint default', function() {
    write('provider.anthropic.endpoint', 'https://api.anthropic.com');
    write('provider.anthropic.authentication.apiKey', '=apiKey');

    migrate();

    expect(read('provider.anthropic.backend.type')).to.equal('anthropic-api');
    expect(read('provider.anthropic.backend.anthropic.apiKey')).to.equal('=apiKey');
    expect(read('provider.anthropic.backend.anthropic.endpoint')).to.be.undefined;
  });


  it('should leave unconfigured tools unset and apply the target prompt default when missing', function() {
    write('data.systemPrompt.prompt', undefined, true);

    migrate();

    expect(read('data.systemPrompt.prompt')).to.equal('="v2 prompt"');
    expect(read('data.tools.containerElementId')).to.be.undefined;
    expect(read('data.tools.toolCallResults')).to.be.undefined;
  });


  it('should use the hidden Vertex endpoint default and migrate visible settings', function() {
    write('provider.type', 'google-vertex-ai');
    write('provider.googleVertexAi.authentication.type', 'applicationDefaultCredentials');
    write('provider.googleVertexAi.endpoint', '=vertexEndpoint');
    write('provider.googleVertexAi.model.parameters.maxOutputTokens', '=512');

    migrate();

    expect(read('provider.type')).to.equal('google-gemini');
    expect(read('provider.googleGemini.backend.type')).to.equal('google-vertex-ai');
    expect(read('provider.googleGemini.model.parameters.maxTokens')).to.equal('=512');
    expect(read('provider.googleGemini.backend.googleVertexAi.endpoint')).to.be.undefined;
  });


  function migrate() {
    const [ loadedTarget ] = elementTemplates.getAll(target.id);

    expect(loadedTarget).to.exist;
    element = elementTemplates.applyTemplate(element, loadedTarget);
  }

  function write(name, value, optional) {
    const property = source.properties.find(property => property.binding.name === name);

    expect(property, name).to.exist;
    setPropertyValue(modeler.get('bpmnFactory'), modeler.get('commandStack'), element, {
      ...property,
      optional: optional ?? property.optional
    }, value);
  }

  function read(name) {
    const ioMapping = findExtension(element, 'zeebe:IoMapping');

    return findInputParameter(ioMapping, { name })?.get('source');
  }

});
