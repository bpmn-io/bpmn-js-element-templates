import { expect } from 'chai';

import Modeler from 'bpmn-js/lib/Modeler';
import ZeebeBehaviors from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import zeebe from 'zeebe-bpmn-moddle/resources/zeebe.json';

import elementTemplatesModule from 'src/cloud-element-templates/core';
import { findExtension, findInputParameter } from 'src/cloud-element-templates/Helper';
import { setPropertyValue } from 'src/cloud-element-templates/util/propertyUtil';
import declaration from 'docs/examples/ai-agent-migrates-from.json';

import diagramXML from './diagram.bpmn';
import { source, target } from './aiAgentTemplates';


describe('migration - AI Agent v1@13 to Sub-process v2@1', function() {

  let modeler, elementTemplates, element;

  beforeEach(async function() {
    modeler = new Modeler({
      additionalModules: [ ZeebeBehaviors, elementTemplatesModule ],
      moddleExtensions: { zeebe },
      elementTemplates: [ source, { ...target, migratesFrom: declaration } ]
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
    it(`should ${ version === 13 ? '' : 'not ' }offer the migration from v1@${ version }`, function() {
      const versioned = { ...source, version };
      const migrated = { ...target, migratesFrom: declaration };

      elementTemplates.set([ versioned, migrated ]);
      elementTemplates.applyTemplate(element, versioned);
      element = modeler.get('elementRegistry').get(element.id);

      expect(elementTemplates.getMigrations(element)).to.eql(version === 13 ? [ migrated ] : []);
    });
  }


  const anthropicCases = [
    [ 'the public API without an endpoint', undefined, 'anthropic-api', 'anthropic' ],
    [ 'the public API with an explicit endpoint', 'https://api.anthropic.com', 'anthropic-api', 'anthropic' ],
    [ 'Microsoft Foundry', 'https://resource.services.ai.azure.com/anthropic', 'foundry', 'foundry' ],
    [ 'a sovereign Foundry host', 'https://resource.services.ai.AZURE.US', 'foundry', 'foundry' ],
    [ 'a custom endpoint with Azure only in the path', 'https://proxy.example/host.azure.com', 'custom', 'custom' ],
    [ 'a custom endpoint that resembles the public host', 'https://api.anthropic.com.proxy.example', 'custom', 'custom' ],
    [ 'a FEEL endpoint without evaluating it', '=endpoint', 'custom', 'custom' ]
  ];

  for (const [ description, endpoint, backend, keyNamespace ] of anthropicCases) {
    it(`should select ${ description } for Anthropic`, function() {
      write('provider.anthropic.endpoint', endpoint);
      write('provider.anthropic.authentication.apiKey', '{{secrets.ANTHROPIC}}');

      migrate();

      const prefix = `provider.anthropic.backend.${ keyNamespace }`;

      expect(read('provider.anthropic.backend.type')).to.equal(backend);
      expect(read(`${ prefix }.${ backend === 'anthropic-api' ? '' : 'authentication.' }apiKey`))
        .to.equal('{{secrets.ANTHROPIC}}');
      expect(read(`${ prefix }.endpoint`)).to.equal(endpoint);
      if (backend === 'anthropic-api' && endpoint) {
        expect(read('provider.anthropic.backend.custom.endpoint')).to.be.undefined;
      }

      expect(read('provider.anthropic.model.parameters.promptCaching.enabled')).to.be.undefined;
    });
  }


  for (const [ provider, oldEndpoint, newEndpoint, value ] of [
    [ 'anthropic', 'provider.anthropic.endpoint', 'provider.anthropic.backend.anthropic.endpoint', 'https://api.anthropic.com' ],
    [ 'google-vertex-ai', 'provider.googleVertexAi.endpoint', 'provider.googleGemini.backend.googleVertexAi.endpoint', '=vertexEndpoint' ]
  ]) {
    it(`should apply normal update behavior to ${ provider } settings`, async function() {
      const destination = { ...target, migratesFrom: declaration };
      elementTemplates.set([ source, destination ]);
      write('provider.type', provider);
      write(oldEndpoint, value);
      write('data.systemPrompt.prompt', '', false);
      migrate();
      expect(read(newEndpoint)).to.equal(value);

      await modeler.importXML((await modeler.saveXML()).xml);
      element = modeler.get('elementRegistry').get(element.id);
      const updated = { ...destination, version: 2 };
      elementTemplates.set([ source, destination, updated ]);
      elementTemplates.applyTemplate(element, updated);

      expect(read(newEndpoint)).to.equal(provider === 'google-vertex-ai' ? undefined : value);
      expect(read('data.systemPrompt.prompt')).to.equal('');
    });
  }


  for (const [ label, key ] of [ [ 'with a key', '=apiKey' ], [ 'without a key', undefined ], [ 'with an empty key', '' ] ]) {
    it(`should select custom OpenAI authentication ${ label }`, function() {
      write('provider.type', 'openaiCompatible');
      write('provider.openaiCompatible.authentication.apiKey', key, false);
      write('provider.openaiCompatible.endpoint', 'https://proxy.example');
      write('provider.openaiCompatible.model.parameters.customParameters', '={ seed: 1 }');

      migrate();

      expect(read('provider.type')).to.equal('openai');
      expect(read('provider.openai.api.type')).to.equal('completions');
      expect(read('provider.openai.backend.type')).to.equal('custom');
      expect(read('provider.openai.backend.custom.authentication.type')).to.equal(key ? 'apiKey' : 'none');
      expect(read('provider.openai.backend.custom.authentication.apiKey')).to.equal(key || undefined);
      expect(read('provider.openai.backend.custom.endpoint')).to.equal('https://proxy.example');
      expect(read('provider.openai.backend.custom.bodyProperties')).to.equal('={ seed: 1 }');
    });
  }


  it('should copy the hidden Vertex endpoint and undo and redo it with the migration', async function() {
    write('provider.type', 'google-vertex-ai');
    write('provider.googleVertexAi.authentication.type', 'applicationDefaultCredentials');
    write('provider.googleVertexAi.endpoint', '=vertexEndpoint');
    write('provider.googleVertexAi.model.parameters.maxOutputTokens', '=512');

    migrate();

    const binding = 'provider.googleGemini.backend.googleVertexAi.endpoint';

    expect(read('provider.googleGemini.backend.type')).to.equal('google-vertex-ai');
    expect(read('provider.googleGemini.model.parameters.maxTokens')).to.equal('=512');
    expect(read(binding)).to.equal('=vertexEndpoint');
    expect((await modeler.saveXML()).xml).to.include(`source="=vertexEndpoint" target="${ binding }"`);

    const commandStack = modeler.get('commandStack');

    commandStack.undo();
    expect(elementTemplates.get(element).id).to.equal(source.id);
    expect(read('provider.googleVertexAi.endpoint')).to.equal('=vertexEndpoint');
    expect(read(binding)).to.be.undefined;

    commandStack.redo();
    expect(elementTemplates.get(element).id).to.equal(target.id);
    expect(read(binding)).to.equal('=vertexEndpoint');
  });


  for (const [ label, prompt ] of [ [ 'missing', undefined ], [ 'empty', '' ], [ 'configured', '=myPrompt' ] ]) {
    it(`should keep a ${ label } v1 system prompt instead of applying the v2 default`, function() {
      write('data.systemPrompt.prompt', prompt, prompt === undefined);

      migrate();

      expect(read('data.systemPrompt.prompt')).to.equal(prompt ?? '');
    });
  }


  it('should retain the v1 default system prompt already stored on the element', function() {
    const original = read('data.systemPrompt.prompt');

    expect(original).to.be.a('string').and.not.be.empty;

    migrate();

    expect(read('data.systemPrompt.prompt')).to.equal(original);
  });


  it('should keep the v1 model and use completions for public OpenAI', function() {
    write('provider.type', 'openai');
    write('provider.openai.authentication.apiKey', '=openaiKey');

    migrate();

    expect(read('provider.openai.api.type')).to.equal('completions');
    expect(read('provider.openai.backend.type')).to.equal('openai-api');
    expect(read('provider.openai.backend.openai.apiKey')).to.equal('=openaiKey');
    expect(read('provider.openai.model.model')).to.equal('gpt-4o');
  });


  it('should map Azure OpenAI credentials to the active Foundry authentication fields', function() {
    write('provider.type', 'azureOpenAi');
    write('provider.azureOpenAi.authentication.type', 'clientCredentials');
    write('provider.azureOpenAi.authentication.clientId', '=clientId');
    write('provider.azureOpenAi.model.deploymentName', 'deployment');

    migrate();

    expect(read('provider.openai.backend.type')).to.equal('foundry');
    expect(read('provider.openai.backend.foundry.authentication.type')).to.equal('clientCredentials');
    expect(read('provider.openai.backend.foundry.authentication.clientId')).to.equal('=clientId');
    expect(read('provider.openai.model.model')).to.equal('deployment');
    expect(read('provider.openai.backend.foundry.authentication.apiKey')).to.be.undefined;
  });


  it('should retain the Bedrock region without turning on the new caching default', function() {
    write('provider.type', 'bedrock');
    write('provider.bedrock.region', 'eu-central-1');

    migrate();

    expect(read('provider.type')).to.equal('bedrock');
    expect(read('provider.bedrock.region')).to.equal('eu-central-1');
    expect(read('provider.bedrock.model.parameters.promptCaching.enabled')).to.be.undefined;
  });

  it('should apply the v2 worker type', function() {
    migrate();

    expect(elementTemplates.get(element).id).to.equal(target.id);
    expect(findExtension(element, 'zeebe:TaskDefinition').get('type')).to.equal('io.camunda.agenticai:aiagent:subprocess:2');
  });


  for (const endpoint of [
    'https://api.anthropic.com/v1',
    'https://resource.services.ai.azure.com/anthropic/v1',
    'https://proxy.example/v1'
  ]) {
    it(`should preserve the endpoint text in ${ endpoint }`, function() {
      write('provider.anthropic.endpoint', endpoint);
      migrate();

      const destination = elementTemplates.get(element).properties.find(property =>
        property.binding.name?.endsWith('.endpoint') && read(property.binding.name) === endpoint
      );
      expect(destination).to.exist;
      expect(destination.type).to.equal('String');
    });
  }


  for (const endpoint of [ '=endpoint', '{{secrets.ENDPOINT}}', 'https://proxy.example/prefix/v1' ]) {
    it(`should retain an unresolved endpoint without rewriting ${ endpoint }`, async function() {
      write('provider.anthropic.endpoint', endpoint);
      migrate();

      expect(read('provider.anthropic.backend.custom.endpoint')).to.equal(endpoint);

      await modeler.importXML((await modeler.saveXML()).xml);
      element = modeler.get('elementRegistry').get(element.id);
      expect(read('provider.anthropic.backend.custom.endpoint')).to.equal(endpoint);

      const updated = { ...elementTemplates.get(element), version: 2 };
      elementTemplates.set([ source, elementTemplates.get(element), updated ]);
      elementTemplates.applyTemplate(element, updated);
      expect(read('provider.anthropic.backend.custom.endpoint')).to.equal(endpoint);
    });
  }


  for (const [ key, headers ] of [
    [ 'static-key', undefined ],
    [ undefined, undefined ],
    [ '=apiKey', undefined ],
    [ '{{secrets.API_KEY}}', undefined ],
    [ 'static-key', '={ Authorization: token }' ],
    [ undefined, '=headers' ]
  ]) {
    it(`should preserve compatible authentication (${ key }, ${ headers })`, function() {
      write('provider.type', 'openaiCompatible');
      write('provider.openaiCompatible.authentication.apiKey', key);
      write('provider.openaiCompatible.headers', headers);
      migrate();

      expect(read('provider.openai.backend.custom.headers')).to.equal(headers);
      expect(read('provider.openai.backend.custom.authentication.apiKey')).to.equal(key);
    });
  }


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
