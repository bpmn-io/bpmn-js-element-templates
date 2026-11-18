import { expect } from 'chai';
import { Linter } from 'bpmnlint';

import Modeler from 'bpmn-js/lib/Modeler';
import ZeebeBehaviors from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import zeebe from 'zeebe-bpmn-moddle/resources/zeebe.json';

import elementTemplatesModule from 'src/cloud-element-templates/core';
import { ElementTemplateLinterPlugin } from 'src/cloud-element-templates/linting';
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


  it('should reject an unsupported provider before changing the element', async function() {
    findInputParameter(findExtension(element, 'zeebe:IoMapping'), { name: 'provider.type' }).set('source', 'unsupported');
    const before = (await modeler.saveXML()).xml;

    expect(migrate).to.throw('Select a supported AI provider before migrating.');

    expect((await modeler.saveXML()).xml).to.equal(before);
    expect(elementTemplates.get(element).id).to.equal(source.id);
  });


  for (const [ provider, oldEndpoint, newEndpoint, value ] of [
    [ 'anthropic', 'provider.anthropic.endpoint', 'provider.anthropic.backend.anthropic.endpoint', 'https://api.anthropic.com' ],
    [ 'google-vertex-ai', 'provider.googleVertexAi.endpoint', 'provider.googleGemini.backend.googleVertexAi.endpoint', '=vertexEndpoint' ]
  ]) {
    it(`should retain ${ provider } hidden settings after reopen and update when persistence is authored`, async function() {
      const persistent = new Set([ newEndpoint, 'data.systemPrompt.prompt', 'provider.anthropic.model.parameters.promptCaching.enabled' ]);
      const destination = {
        ...target,
        migratesFrom: declaration,
        properties: target.properties.map(property => persistent.has(property.binding.name) ? { ...property, persist: true } : property)
      };
      elementTemplates.set([ source, destination ]);
      write('provider.type', provider);
      write(oldEndpoint, value);
      write('data.systemPrompt.prompt', '', false);
      migrate();

      await modeler.importXML((await modeler.saveXML()).xml);
      element = modeler.get('elementRegistry').get(element.id);
      const updated = { ...destination, version: 2 };
      elementTemplates.set([ source, destination, updated ]);
      elementTemplates.applyTemplate(element, updated);

      expect(read(newEndpoint)).to.equal(value);
      expect(read('data.systemPrompt.prompt')).to.equal('');
      if (provider === 'anthropic') {
        expect(read('provider.anthropic.model.parameters.promptCaching.enabled')).to.be.undefined;
      }
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


  it('should persist the hidden Vertex endpoint and undo and redo it with the migration', async function() {
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

  it('should upgrade in one command and surface the deployment action without blanket field checks', async function() {
    migrate();

    expect(elementTemplates.get(element).id).to.equal(target.id);
    expect(findExtension(element, 'zeebe:TaskDefinition').get('type')).to.equal('io.camunda.agenticai:aiagent:subprocess:2');
    const reports = await lint();
    expect(reports).to.have.length(1);
    expect(reports[0]).to.include({ category: 'error' });
    expect(reports[0].message).to.include('v2 worker');
    expect(reports[0].propertiesPanel.entryIds).to.deep.equal([ `custom-entry-${ target.id }-migration-2` ]);

    review('migration.deploymentReview');
    expect(await lint()).to.be.empty;
  });


  for (const [ endpoint, message ] of [
    [ 'https://api.anthropic.com/v1', 'Remove the trailing /v1' ],
    [ 'https://resource.services.ai.azure.com/anthropic/v1', 'Remove the trailing /anthropic/v1' ],
    [ 'https://proxy.example/v1', 'Remove the root /v1' ]
  ]) {
    it(`should preserve and report the actionable suffix in ${ endpoint }`, async function() {
      write('provider.anthropic.endpoint', endpoint);
      migrate();
      review('migration.deploymentReview');

      const reports = await lint();
      expect(reports).to.have.length(1);
      expect(reports[0].message).to.include(message);
      expect(reports[0].propertiesPanel.entryIds).to.have.length(1);

      const destination = elementTemplates.get(element).properties.find(property =>
        property.binding.name?.endsWith('.endpoint') && read(property.binding.name) === endpoint
      );
      expect(destination.type).to.equal('String');
      setPropertyValue(modeler.get('bpmnFactory'), modeler.get('commandStack'), element, destination,
        endpoint.replace(/\/(?:anthropic\/)?v1$/, ''));

      expect(await lint()).to.be.empty;
    });
  }


  for (const endpoint of [ '=endpoint', '{{secrets.ENDPOINT}}', 'https://proxy.example/prefix/v1' ]) {
    it(`should report an unresolved endpoint without rewriting ${ endpoint }`, async function() {
      write('provider.anthropic.endpoint', endpoint);
      migrate();
      review('migration.deploymentReview');

      expect(read('provider.anthropic.backend.custom.endpoint')).to.equal(endpoint);
      expect((await lint()).map(report => report.message)).to.have.length(1).and.satisfy(messages =>
        messages[0].includes('Anthropic endpoint compatibility')
      );

      await modeler.importXML((await modeler.saveXML()).xml);
      element = modeler.get('elementRegistry').get(element.id);
      expect(await lint()).to.have.length(1);

      const updated = { ...elementTemplates.get(element), version: 2 };
      elementTemplates.set([ source, elementTemplates.get(element), updated ]);
      elementTemplates.applyTemplate(element, updated);
      expect(await lint()).to.have.length(1);

      review('migration.endpointReview');
      expect(await lint()).to.be.empty;
      modeler.get('commandStack').undo();
      expect(await lint()).to.have.length(1);
      modeler.get('commandStack').redo();
      expect(await lint()).to.be.empty;
    });
  }


  for (const [ key, headers, reviewNeeded ] of [
    [ 'static-key', undefined, false ],
    [ undefined, undefined, false ],
    [ '=apiKey', undefined, true ],
    [ '{{secrets.API_KEY}}', undefined, true ],
    [ 'static-key', '={ Authorization: token }', true ],
    [ undefined, '=headers', true ]
  ]) {
    it(`should report only unresolved compatible authentication (${ key }, ${ headers })`, async function() {
      write('provider.type', 'openaiCompatible');
      write('provider.openaiCompatible.authentication.apiKey', key);
      write('provider.openaiCompatible.headers', headers);
      migrate();
      review('migration.deploymentReview');

      expect(read('provider.openai.backend.custom.headers')).to.equal(headers);
      const reports = await lint();
      expect(reports).to.have.length(reviewNeeded ? 1 : 0);

      if (reviewNeeded) {
        expect(reports[0].message).to.include('Authorization overrides the old key');
        review('migration.authReview');
        expect(await lint()).to.be.empty;
      }
    });
  }


  it('should undo and redo the upgrade together with its lint action items', async function() {
    write('provider.anthropic.endpoint', '=endpoint');
    migrate();
    expect(await lint()).to.have.length(2);

    modeler.get('commandStack').undo();
    expect(elementTemplates.get(element).id).to.equal(source.id);
    expect(await lint()).to.be.empty;

    modeler.get('commandStack').redo();
    expect(elementTemplates.get(element).id).to.equal(target.id);
    expect(await lint()).to.have.length(2);
  });


  async function lint() {
    const linter = new Linter(ElementTemplateLinterPlugin(elementTemplates.getAll()));
    const reports = await linter.lint(modeler.getDefinitions());

    return (reports['element-templates/validate'] || []).filter(report => report.id === element.id);
  }

  function review(id) {
    const property = elementTemplates.get(element).properties.find(property => property.id === id);
    setPropertyValue(modeler.get('bpmnFactory'), modeler.get('commandStack'), element, property, 'reviewed');
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
