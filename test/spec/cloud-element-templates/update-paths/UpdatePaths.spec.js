import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';
import { spy } from 'sinon';

import { act } from '@testing-library/preact';

import {
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe.json';

import {
  bootstrapPropertiesPanel,
  clickInput as click,
  getBpmnJS,
  inject
} from 'test/TestHelper';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';

import elementTemplatesModule from 'src/cloud-element-templates';

import {
  findExtension,
  findInputParameter,
  findTaskHeader
} from 'src/cloud-element-templates/Helper';

import {
  getPropertyValue,
  setPropertyValue
} from 'src/cloud-element-templates/util/propertyUtil';

import diagramXML from './diagram.bpmn';
import templates from './templates.json';

const [ sourceV1, sourceV2, targetV1, , target ] = templates;

const sourceUpdate = { type: 'update', template: sourceV2, version: 2, text: 'Source: a is now b.' },
      targetUpdateV2 = { type: 'update', template: target, version: 2, text: 'Target: x is now c, w is now e.' },
      migration = { type: 'migration', template: target, text: 'Source: b is now c.' },
      targetUpdateV3 = { type: 'update', template: target, version: 3, text: 'Target: c is now d.' };


/**
 * Source v1 -> v2 renames `a` to `b`.
 *
 * Target v1 -> v2 renames `x` to `c` and `w` to `e`, and declares migrations
 * from Source (`b` to `c`, and more) and Other (`o` to `c`). Target v2 -> v3
 * renames `c` to `d`.
 *
 * Stray values on elements reveal paths that must not apply.
 */
describe('provider/cloud-element-templates - update paths', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapPropertiesPanel(diagramXML, {
    container,
    modules: [
      BpmnPropertiesPanelModule,
      coreModule,
      BpmnPropertiesProviderModule,
      ZeebePropertiesProviderModule,
      elementTemplatesModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    },
    debounceInput: false,
    elementTemplates: templates
  }));


  describe('update', function() {

    it('should chain paths across versions', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('TargetV1'), target);

      // then
      expect(getInput(element, 'd')).to.eql('X1');
      expect(getInput(element, 'e')).to.eql('W1');
      expect(getInput(element, 'x')).not.to.exist;
      expect(getInput(element, 'c')).not.to.exist;
    }));


    it('should only apply paths above element version', inject(function(elementRegistry, elementTemplates) {

      // when
      // stray `x`, moved to `c` by the first path
      const element = elementTemplates.applyTemplate(elementRegistry.get('TargetV2'), target);

      // then
      expect(getInput(element, 'd')).to.eql('C2');
      expect(getInput(element, 'e')).to.eql('E2');
    }));


    it('should skip migration paths', inject(function(elementRegistry, elementTemplates) {

      // when
      // stray `b`, moved to `c` by the migration path
      const element = elementTemplates.applyTemplate(elementRegistry.get('TargetV1'), target);

      // then
      expect(getInput(element, 'd')).to.eql('X1');
    }));

  });


  describe('migrate', function() {

    it('should move value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV2'), target);

      // then
      expect(getInput(element, 'd')).to.eql('B2');
      expect(getInput(element, 'b')).not.to.exist;
    }));


    it('should map value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getHeader(element, 'method')).to.eql('post');
    }));


    it('should map unlisted value via fallback', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'authentication.type')).to.eql('apiKey');
    }));


    it('should not move empty value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV2'), target);

      // then
      expect(getInput(element, 'authentication.type')).to.eql('none');
    }));


    it('should move Boolean and Number values within the same kind of binding', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getValue(element, 'enabled')).to.be.false;
      expect(getInput(element, 'retries')).to.eql('=false');
      expect(getInput(element, 'total')).to.eql('=5');
      expect(getValue(element, 'max')).to.eql('5');
    }));


    it('should map Boolean values across kinds of binding', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getValue(element, 'toggled')).to.be.false;
      expect(getInput(element, 'switched')).to.eql('=false');
    }));


    it('should move value to property activated by migration', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'body')).to.eql('=payload');
    }));


    it('should not move value to Hidden property', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getTaskType(element)).to.eql('example.target');
    }));


    it('should keep value of unchanged binding', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'timeout')).to.eql('PT1M');
    }));


    it('should update source before migrating', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'd')).to.eql('A1');
    }));


    it('should update incompatible source before migrating', inject(function(elementRegistry, elementTemplates) {

      // given
      elementTemplates.setEngines({ camunda: '8.10' });

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'd')).to.eql('A1');
    }));


    it('should only apply target paths declared after migration path', inject(function(elementRegistry, elementTemplates) {

      // when
      // stray `w`, moved to `e` by the first path
      const element = elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // then
      expect(getInput(element, 'e')).not.to.eql('stray');
    }));


    it('should migrate from each declared source', inject(function(elementRegistry, elementTemplates) {

      // when
      const source = elementTemplates.applyTemplate(elementRegistry.get('SourceV2'), target);
      const other = elementTemplates.applyTemplate(elementRegistry.get('OtherV1'), target);

      // then
      expect(getInput(source, 'd')).to.eql('B2');
      expect(getInput(other, 'd')).to.eql('O1');
    }));


    it('should not migrate from template that is not loaded', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Unknown'), target);

      // then
      expect(getInput(element, 'd')).not.to.exist;
    }));


    it('should undo in one step', inject(function(elementRegistry, elementTemplates, commandStack) {

      // given
      elementTemplates.applyTemplate(elementRegistry.get('SourceV1'), target);

      // when
      commandStack.undo();

      // then
      const element = elementRegistry.get('SourceV1');

      expect(elementTemplates.get(element)).to.equal(sourceV1);
      expect(getInput(element, 'a')).to.eql('A1');
      expect(getInput(element, 'd')).not.to.exist;
      expect(getHeader(element, 'method')).to.eql('POST');
    }));

  });


  describe('conditions', function() {

    const provider = {
      id: 'provider',
      type: 'Dropdown',
      value: 'openai',
      choices: [ { name: 'OpenAI', value: 'openai' }, { name: 'Azure', value: 'azure' } ],
      binding: { type: 'zeebe:input', name: 'provider' }
    };

    const openaiModel = {
      id: 'openaiModel',
      type: 'String',
      binding: { type: 'zeebe:input', name: 'openaiModel' },
      condition: { property: 'provider', equals: 'openai' }
    };

    const azureModel = {
      id: 'azureModel',
      type: 'String',
      binding: { type: 'zeebe:input', name: 'azureModel' },
      condition: { property: 'provider', equals: 'azure' }
    };

    it('should not move values of inactive properties', inject(function(elementTemplates) {

      // given
      const model = { id: 'model', type: 'String', binding: { type: 'zeebe:input', name: 'model' } };

      const oldTemplate = createTemplate(1, [ provider, openaiModel, azureModel ]);
      const newTemplate = createTemplate(2, [ provider, model ], [
        {
          beforeVersion: 2,
          hints: [
            { from: openaiModel.binding, to: model.binding },
            { from: azureModel.binding, to: model.binding }
          ]
        }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { openaiModel: 'gpt' });

      // stray value of an inactive property
      setInput(element, 'azureModel', 'stray');

      // when
      const updated = elementTemplates.applyTemplate(element, newTemplate);

      // then
      expect(getInput(updated, 'model')).to.eql('gpt');
    }));


    it('should move values regardless of activation order', inject(function(elementTemplates) {

      // given
      const backend = {
        id: 'backend',
        type: 'Dropdown',
        value: 'none',
        choices: [ { name: 'None', value: 'none' }, { name: 'Anthropic', value: 'anthropic' } ],
        binding: { type: 'zeebe:input', name: 'backend' }
      };

      const caching = {
        id: 'caching',
        type: 'String',
        value: 'on',
        binding: { type: 'zeebe:input', name: 'caching' },
        condition: { property: 'backend', equals: 'anthropic' }
      };

      const oldTemplate = createTemplate(1, [ provider ]);
      const newTemplate = createTemplate(2, [ provider, backend, caching ], [
        {
          beforeVersion: 2,
          hints: [
            { from: provider.binding, to: caching.binding, values: { '*': 'off' } },
            { from: provider.binding, to: backend.binding, values: { '*': 'anthropic' } }
          ]
        }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { provider: 'azure' });

      // when
      const updated = elementTemplates.applyTemplate(element, newTemplate);

      // then
      expect(getInput(updated, 'backend')).to.eql('anthropic');
      expect(getInput(updated, 'caching')).to.eql('off');
    }));


    it('should move value to property declared before its activator', inject(function(elementTemplates) {

      // given
      const backend = {
        id: 'backend',
        type: 'Dropdown',
        value: 'none',
        choices: [ { name: 'None', value: 'none' }, { name: 'Anthropic', value: 'anthropic' } ],
        binding: { type: 'zeebe:input', name: 'backend' }
      };

      const caching = {
        id: 'caching',
        type: 'String',
        value: 'on',
        binding: { type: 'zeebe:input', name: 'caching' },
        condition: { property: 'backend', equals: 'anthropic' }
      };

      const oldTemplate = createTemplate(1, [ provider ]);
      const newTemplate = createTemplate(2, [ provider, caching, backend ], [
        {
          beforeVersion: 2,
          hints: [
            { from: provider.binding, to: caching.binding, values: { '*': 'off' } },
            { from: provider.binding, to: backend.binding, values: { '*': 'anthropic' } }
          ]
        }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { provider: 'azure' });

      // when
      const updated = elementTemplates.applyTemplate(element, newTemplate);

      // then
      expect(getInput(updated, 'backend')).to.eql('anthropic');
      expect(getInput(updated, 'caching')).to.eql('off');
    }));


    describe('version bump', function() {

      const apiKey = {
        id: 'apiKey',
        type: 'String',
        binding: { type: 'zeebe:input', name: 'apiKey' }
      };

      const azureApiKey = {
        ...apiKey,
        condition: { property: 'provider', equals: 'azure' }
      };

      const openaiApiKey = {
        id: 'openaiApiKey',
        type: 'String',
        binding: { type: 'zeebe:input', name: 'openaiApiKey' },
        condition: { property: 'provider', equals: 'openai' }
      };


      it('should remove value of property deactivated by update', inject(function(elementTemplates) {

        // given
        const oldTemplate = createTemplate(1, [ provider, apiKey ]);
        const newTemplate = createTemplate(2, [ provider, azureApiKey ]);

        elementTemplates.set([ oldTemplate, newTemplate ]);

        const element = createElement(oldTemplate, { apiKey: 'secret' });

        // when
        const updated = elementTemplates.applyTemplate(element, newTemplate);

        // then
        expect(getInput(updated, 'apiKey')).not.to.exist;
      }));


      it('should keep value moved to active property', inject(function(elementTemplates) {

        // given
        const oldTemplate = createTemplate(1, [ provider, apiKey ]);
        const newTemplate = createTemplate(2, [ provider, azureApiKey, openaiApiKey ], [
          { beforeVersion: 2, hints: [ { from: apiKey.binding, to: openaiApiKey.binding } ] }
        ]);

        elementTemplates.set([ oldTemplate, newTemplate ]);

        const element = createElement(oldTemplate, { apiKey: 'secret' });

        // when
        const updated = elementTemplates.applyTemplate(element, newTemplate);

        // then
        expect(getInput(updated, 'openaiApiKey')).to.eql('secret');
        expect(getInput(updated, 'apiKey')).not.to.exist;
      }));


      it('should keep value deactivated only by an intermediate version', inject(function(elementTemplates) {

        // given
        const v1 = createTemplate(1, [ provider, apiKey ]);
        const v2 = createTemplate(2, [ provider, azureApiKey ]);
        const v3 = createTemplate(3, [ provider, apiKey ]);

        elementTemplates.set([ v1, v2, v3 ]);

        const element = createElement(v1, { apiKey: 'secret' });

        // when
        const updated = elementTemplates.applyTemplate(element, v3);

        // then
        expect(getInput(updated, 'apiKey')).to.eql('secret');
      }));


      it('should chain moves across versions with conditions', inject(function(elementTemplates) {

        // given
        const v1 = createTemplate(1, [ provider, apiKey ]);
        const v2 = createTemplate(2, [ provider, azureApiKey, openaiApiKey ], [
          { beforeVersion: 2, hints: [ { from: apiKey.binding, to: openaiApiKey.binding } ] }
        ]);

        const token = {
          id: 'token',
          type: 'String',
          binding: { type: 'zeebe:input', name: 'token' },
          condition: { property: 'provider', equals: 'openai' }
        };

        const v3 = createTemplate(3, [ provider, azureApiKey, token ], [
          ...v2.updatePaths,
          { beforeVersion: 3, hints: [ { from: openaiApiKey.binding, to: token.binding } ] }
        ]);

        elementTemplates.set([ v1, v2, v3 ]);

        const element = createElement(v1, { apiKey: 'secret' });

        // when
        const updated = elementTemplates.applyTemplate(element, v3);

        // then
        expect(getInput(updated, 'token')).to.eql('secret');
        expect(getInput(updated, 'openaiApiKey')).not.to.exist;
        expect(getInput(updated, 'apiKey')).not.to.exist;
      }));

    });


    it('should not re-apply moved values on later changes', inject(function(bpmnFactory, commandStack, elementTemplates) {

      // given
      const backend = {
        id: 'backend',
        type: 'Dropdown',
        value: 'none',
        choices: [ { name: 'None', value: 'none' }, { name: 'Anthropic', value: 'anthropic' } ],
        binding: { type: 'zeebe:input', name: 'backend' }
      };

      const caching = {
        id: 'caching',
        type: 'String',
        value: 'on',
        binding: { type: 'zeebe:input', name: 'caching' },
        condition: { property: 'backend', equals: 'anthropic' }
      };

      const model = {
        id: 'model',
        type: 'String',
        binding: { type: 'zeebe:input', name: 'model' }
      };

      const oldTemplate = createTemplate(1, [ provider, model ]);
      const newTemplate = createTemplate(2, [ provider, model, backend, caching ], [
        {
          beforeVersion: 2,
          hints: [ { from: model.binding, to: model.binding, values: { '*': 'moved' } } ]
        }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { model: 'gpt' });

      const updated = elementTemplates.applyTemplate(element, newTemplate);

      setPropertyValue(bpmnFactory, commandStack, updated, model, 'user');

      // when
      setPropertyValue(bpmnFactory, commandStack, updated, backend, 'anthropic');

      // then
      expect(getInput(updated, 'caching')).to.eql('on');
      expect(getInput(updated, 'model')).to.eql('user');
    }));

  });


  describe('presets', function() {

    it('should apply preset, keeping moved and preserved values', inject(function(elementTemplates) {

      // given
      const operation = { id: 'operation', type: 'String', binding: { type: 'zeebe:input', name: 'operation' } };
      const url = { id: 'url', type: 'String', binding: { type: 'zeebe:input', name: 'url' } };
      const endpoint = { id: 'endpoint', type: 'String', binding: { type: 'zeebe:input', name: 'endpoint' } };
      const token = { id: 'token', type: 'String', binding: { type: 'zeebe:input', name: 'token' } };

      const oldTemplate = createTemplate(1, [ operation, url, token ]);
      const newTemplate = {
        ...createTemplate(2, [ operation, endpoint, token ], [
          {
            beforeVersion: 2,
            hints: [
              { from: operation.binding, to: operation.binding, values: { delete: 'remove' } },
              { from: url.binding, to: endpoint.binding }
            ]
          }
        ]),
        presets: [ { id: 'create', properties: { operation: 'create' } } ]
      };

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { operation: 'delete', url: 'https://example.com', token: 'secret' });

      // when
      const updated = elementTemplates.applyTemplate(element, newTemplate, { presetId: 'create' });

      // then
      expect(getInput(updated, 'operation')).to.eql('create');
      expect(getInput(updated, 'endpoint')).to.eql('https://example.com');
      expect(getInput(updated, 'token')).to.eql('secret');
    }));

  });


  describe('binding types', function() {

    const source = { id: 'source', type: 'String', binding: { type: 'zeebe:input', name: 'source' } };

    const TARGETS = {
      'zeebe:input': { binding: { type: 'zeebe:input', name: 'target' } },
      'zeebe:output': { binding: { type: 'zeebe:output', source: '=result' } },
      'zeebe:taskHeader': { binding: { type: 'zeebe:taskHeader', key: 'target' } },
      'zeebe:property': { binding: { type: 'zeebe:property', name: 'target' } },
      'property': { binding: { type: 'property', name: 'name' } },
      'zeebe:taskDefinition': { binding: { type: 'zeebe:taskDefinition', property: 'retries' } }
    };

    Object.entries(TARGETS).forEach(([ type, { binding } ]) => {

      it(`should move value to <${ type }>`, inject(function(elementTemplates) {

        // given
        const target = { id: 'target', type: 'String', binding };

        const oldTemplate = createTemplate(1, [ source ]);
        const newTemplate = createTemplate(2, [ target ], [
          { beforeVersion: 2, hints: [ { from: source.binding, to: binding } ] }
        ]);

        elementTemplates.set([ oldTemplate, newTemplate ]);

        const element = createElement(oldTemplate, { source: '5' });

        // when
        const updated = elementTemplates.applyTemplate(element, newTemplate);

        // then
        expect(getPropertyValue(updated, target)).to.eql('5');
      }));

    });


    it('should move value that is not a valid choice', inject(function(elementTemplates) {

      // given
      const method = {
        id: 'method',
        type: 'Dropdown',
        value: 'get',
        choices: [ { name: 'GET', value: 'get' }, { name: 'POST', value: 'post' } ],
        binding: { type: 'zeebe:input', name: 'method' }
      };

      const oldTemplate = createTemplate(1, [ source ]);
      const newTemplate = createTemplate(2, [ method ], [
        { beforeVersion: 2, hints: [ { from: source.binding, to: method.binding } ] }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { source: 'PUT' });

      // when
      const updated = elementTemplates.applyTemplate(element, newTemplate);

      // then
      expect(getInput(updated, 'method')).to.eql('PUT');
    }));

  });


  describe('paths without hints', function() {

    const timeout = { id: 'timeout', type: 'String', binding: { type: 'zeebe:input', name: 'timeout' } };


    it('should offer update, with changes', inject(function(elementTemplates) {

      // given
      const oldTemplate = createTemplate(1, [ timeout ]);
      const newTemplate = createTemplate(2, [ timeout ], [
        { beforeVersion: 2, changes: 'Requests now time out after 30 seconds.' }
      ]);

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { timeout: '10' });

      // when
      const update = elementTemplates.getUpdate(element);
      const details = elementTemplates.getUpdateDetails(element, newTemplate);

      // then
      expect(update).to.eql({ type: 'update', template: newTemplate });
      expect(details).to.eql({
        changes: [
          { type: 'update', template: newTemplate, version: 2, text: 'Requests now time out after 30 seconds.' }
        ]
      });
    }));


    it('should offer migration, with message and changes', inject(function(elementTemplates) {

      // given
      const oldTemplate = createTemplate(1, [ timeout ]);
      const newTemplate = {
        ...createTemplate(1, [ timeout ], [
          {
            templateId: oldTemplate.id,
            message: 'Migration to Next is available.',
            changes: 'Next supports streaming.'
          }
        ]),
        id: 'example.next',
        name: 'Next'
      };

      elementTemplates.set([ oldTemplate, newTemplate ]);

      const element = createElement(oldTemplate, { timeout: '10' });

      // when
      const update = elementTemplates.getUpdate(element);
      const details = elementTemplates.getUpdateDetails(element, newTemplate);

      // then
      expect(update).to.eql({ type: 'migration', template: newTemplate });
      expect(details).to.eql({
        message: 'Migration to Next is available.',
        changes: [
          { type: 'migration', template: newTemplate, text: 'Next supports streaming.' }
        ]
      });
    }));

  });


  describe('#getUpdateDetails', function() {

    it('should return update changes, oldest first', inject(function(elementRegistry, elementTemplates) {

      // when
      const details = elementTemplates.getUpdateDetails(elementRegistry.get('TargetV1'), target);

      // then
      expect(details).to.eql({
        changes: [ targetUpdateV2, targetUpdateV3 ]
      });
    }));


    it('should only return update changes above element version', inject(function(elementRegistry, elementTemplates) {

      // when
      const details = elementTemplates.getUpdateDetails(elementRegistry.get('TargetV2'), target);

      // then
      expect(details).to.eql({ changes: [ targetUpdateV3 ] });
    }));


    it('should return migration changes, including source updates', inject(function(elementRegistry, elementTemplates) {

      // when
      const details = elementTemplates.getUpdateDetails(elementRegistry.get('SourceV1'), target);

      // then
      expect(details).to.eql({
        message: 'Migrate to Target.',
        changes: [ sourceUpdate, migration, targetUpdateV3 ]
      });
    }));


    it('should return migration changes from latest source version', inject(function(elementRegistry, elementTemplates) {

      // when
      const details = elementTemplates.getUpdateDetails(elementRegistry.get('SourceV2'), target);

      // then
      expect(details).to.eql({
        message: 'Migrate to Target.',
        changes: [ migration, targetUpdateV3 ]
      });
    }));

  });


  describe('#getUpdate', function() {

    it('should prefer migration over update of source', inject(function(elementRegistry, elementTemplates) {

      // when
      const update = elementTemplates.getUpdate(elementRegistry.get('SourceV1'));

      // then
      expect(update).to.eql({ type: 'migration', template: target });
    }));


    it('should offer chained migrations one at a time', inject(function(elementRegistry, elementTemplates) {

      // given
      const next = {
        ...targetV1,
        id: 'example.next',
        name: 'Next',
        updatePaths: [ { templateId: 'example.target' } ]
      };

      elementTemplates.set([ ...templates, next ]);

      // when
      const sourceUpdate = elementTemplates.getUpdate(elementRegistry.get('SourceV1'));
      const targetUpdate = elementTemplates.getUpdate(elementRegistry.get('TargetV1'));

      // then
      expect(sourceUpdate).to.eql({ type: 'migration', template: target });
      expect(targetUpdate).to.eql({ type: 'migration', template: next });
    }));

  });


  describe('properties panel', function() {

    describe('update', function() {

      it('should request changes review', inject(async function(elementRegistry, selection, eventBus) {

        // given
        const element = elementRegistry.get('TargetV1');

        const reviewSpy = spy();

        eventBus.on('elementTemplates.reviewChanges', reviewSpy);

        await act(() => selection.select(element));

        // when
        await clickMenuItem(container, 'Review changes');

        // then
        expect(reviewSpy).to.have.been.calledOnce;
        expect(reviewSpy.getCall(0).args[0]).to.include({
          element,
          oldTemplate: targetV1,
          newTemplate: target
        });

        expect(reviewSpy.getCall(0).args[0].changes).to.eql([ targetUpdateV2, targetUpdateV3 ]);
      }));


      it('should update', inject(async function(elementRegistry, selection, elementTemplates) {

        // given
        await act(() => selection.select(elementRegistry.get('TargetV1')));

        // when
        await clickMenuItem(container, 'Update');

        // then
        const element = elementRegistry.get('TargetV1');

        expect(elementTemplates.get(element)).to.equal(target);
        expect(getInput(element, 'd')).to.eql('X1');
      }));

    });


    describe('migrate', function() {

      it('should offer migration', inject(async function(elementRegistry, selection) {

        // when
        await act(() => selection.select(elementRegistry.get('SourceV1')));

        // then
        const button = domQuery('.bio-properties-panel-template-migration-available', container);

        expect(button).to.exist;

        const text = domQuery('.bio-properties-panel-template-migration-available-text', button);

        expect(text.textContent).to.eql('Migrate to Target.');
      }));


      it('should request changes review', inject(async function(elementRegistry, selection, eventBus) {

        // given
        const element = elementRegistry.get('SourceV1');

        const reviewSpy = spy();

        eventBus.on('elementTemplates.reviewChanges', reviewSpy);

        await act(() => selection.select(element));

        // when
        await clickMenuItem(container, 'Review changes');

        // then
        expect(reviewSpy).to.have.been.calledOnce;
        expect(reviewSpy.getCall(0).args[0]).to.include({
          element,
          oldTemplate: sourceV1,
          newTemplate: target,
          message: 'Migrate to Target.'
        });

        expect(reviewSpy.getCall(0).args[0].changes).to.eql([ sourceUpdate, migration, targetUpdateV3 ]);
      }));


      it('should migrate', inject(async function(elementRegistry, selection, elementTemplates) {

        // given
        await act(() => selection.select(elementRegistry.get('SourceV1')));

        // when
        await clickMenuItem(container, 'Migrate');

        // then
        const element = elementRegistry.get('SourceV1');

        expect(elementTemplates.get(element)).to.equal(target);
        expect(getInput(element, 'd')).to.eql('A1');
        expect(domQuery('.bio-properties-panel-template-migration-available', container)).not.to.exist;
      }));

    });

  });

});


// helpers //////////

function createTemplate(version, properties, updatePaths) {
  return {
    id: 'example.conditional',
    name: 'Conditional',
    version,
    appliesTo: [ 'bpmn:Task' ],
    elementType: { value: 'bpmn:ServiceTask' },
    properties: [
      { type: 'Hidden', value: 'example.conditional', binding: { type: 'zeebe:taskDefinition', property: 'type' } },
      ...properties
    ],
    updatePaths
  };
}

function createElement(template, values) {
  return getBpmnJS().invoke(function(bpmnFactory, canvas, commandStack, elementFactory, elementTemplates, modeling) {
    const shape = modeling.createShape(
      elementFactory.createShape({ type: 'bpmn:Task' }),
      { x: 600, y: 600 },
      canvas.getRootElement()
    );

    const element = elementTemplates.applyTemplate(shape, template);

    Object.entries(values).forEach(([ id, value ]) => {
      const property = template.properties.find(property => property.id === id);

      setPropertyValue(bpmnFactory, commandStack, element, property, value);
    });

    return element;
  });
}


function getInput(element, name) {
  const ioMapping = findExtension(element, 'zeebe:IoMapping');

  return ioMapping && findInputParameter(ioMapping, { name })?.get('source');
}

function setInput(element, name, source) {
  const ioMapping = findExtension(element, 'zeebe:IoMapping');

  ioMapping.get('inputParameters').push(
    ioMapping.$model.create('zeebe:Input', { source, target: name })
  );
}

function getHeader(element, key) {
  const taskHeaders = findExtension(element, 'zeebe:TaskHeaders');

  return taskHeaders && findTaskHeader(taskHeaders, { key })?.get('value');
}

function getValue(element, id) {
  const property = target.properties.find(property => property.id === id);

  return getPropertyValue(element, property);
}

function getTaskType(element) {
  return findExtension(element, 'zeebe:TaskDefinition').get('type');
}

function clickMenuItem(container, text) {
  const item = Array.from(domQueryAll('.bio-properties-panel-dropdown-button__menu-item', container))
    .find(item => item.textContent === text);

  if (!item) {
    throw new Error(`menu item <${ text }> missing`);
  }

  return click(item);
}
