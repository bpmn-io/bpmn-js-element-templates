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
import { getValidationErrors } from 'src/cloud-element-templates/util/migrationUtil';

import diagramXML from './diagram.bpmn';
import templates from './templates.json';
import restSteps from 'docs/examples/rest-connector-migrates-from.json';

const [ legacyTemplate, targetTemplate ] = templates;


describe('provider/cloud-element-templates - migration', function() {

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


  describe('migrate', function() {

    it('should move hinted value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'endpoint')).to.eql('https://custom.io');
      expect(getInput(element, 'url')).not.to.exist;
    }));


    it('should map hinted value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getHeader(element, 'method')).to.eql('post');
    }));


    it('should move value to property activated by migration', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'body')).to.eql('=payload');
    }));


    it('should keep value of unchanged binding', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'timeout')).to.eql('PT1M');
    }));


    it('should not migrate from template that is not loaded', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Unknown'), targetTemplate);

      // then
      expect(getInput(element, 'endpoint')).to.eql('https://example.com');
    }));


    it('should undo in one step', inject(function(elementRegistry, elementTemplates, commandStack) {

      // given
      elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // when
      commandStack.undo();

      // then
      const element = elementRegistry.get('Legacy');

      expect(elementTemplates.get(element)).to.equal(legacyTemplate);
      expect(getInput(element, 'url')).to.eql('https://custom.io');
      expect(getInput(element, 'endpoint')).not.to.exist;
      expect(getHeader(element, 'method')).to.eql('POST');
    }));

  });


  describe('migration instructions', function() {
    const input = name => ({ type: 'zeebe:input', name });
    const endpoint = input('endpoint');
    const method = { type: 'zeebe:taskHeader', key: 'method' };
    const body = input('body');
    const copy = { from: input('url'), to: endpoint };

    function targetWith(properties, fields = targetTemplate.properties) {
      return {
        ...targetTemplate,
        properties: fields,
        migratesFrom: [ { id: legacyTemplate.id, properties } ]
      };
    }

    it('should compose selection, capture replacement, and conditional writes',
      inject(function(elementRegistry, elementTemplates, commandStack) {
        const target = targetWith([
          {
            when: { binding: input('url'), equals: 'not selected' },
            properties: [ copy ]
          },
          {
            when: { binding: input('url'), matches: '^https://' },
            properties: [ { ...copy, replace: { pattern: '^https://(.*)$', replacement: 'https://api.$1' } } ]
          },
          { to: method, set: 'post' },
          { from: input('payload'), to: body }
        ]);
        elementTemplates.set([ legacyTemplate, target ]);
        const element = elementRegistry.get('Legacy');

        elementTemplates.applyTemplate(element, target);

        expect(getInput(element, 'endpoint')).to.equal('https://api.custom.io');
        expect(getInput(element, 'body')).to.equal('=payload');
        commandStack.undo();
        expect(elementTemplates.get(element)).to.equal(legacyTemplate);
        commandStack.redo();
        expect(getInput(element, 'endpoint')).to.equal('https://api.custom.io');
        expect(getInput(element, 'body')).to.equal('=payload');
      }));

    const failures = [
      [ 'an invalid replacement pattern', {
        ...copy, replace: { pattern: '[', replacement: '' }
      }, /regular expression/i ],
      [ 'a replacement without a pattern', {
        ...copy, replace: { replacement: '' }
      }, /pattern/ ],
      [ 'an expression replacement', {
        from: input('payload'), to: endpoint, replace: { pattern: 'payload', replacement: 'changed' }
      }, /static string/ ]
    ];

    for (const [ label, instruction, error ] of failures) {
      it(`should reject ${ label } without changing XML or damaging undo`,
        inject(async function(bpmnjs, elementRegistry, elementTemplates, commandStack) {
          const target = targetWith([ { to: endpoint, set: 'must not be applied' }, instruction ]);
          elementTemplates.set([ legacyTemplate, target ]);
          const element = elementRegistry.get('Legacy');
          const before = (await bpmnjs.saveXML()).xml;
          const canUndo = commandStack.canUndo();

          expect(() => elementTemplates.applyTemplate(element, target)).to.throw(error);

          expect((await bpmnjs.saveXML()).xml).to.equal(before);
          expect(commandStack.canUndo()).to.equal(canUndo);
          elementTemplates.applyTemplate(element, targetTemplate);
          commandStack.undo();
          expect(elementTemplates.get(element)).to.equal(legacyTemplate);
          expect(getInput(element, 'url')).to.equal('https://custom.io');
          expect(getInput(element, 'endpoint')).to.be.undefined;
          expect(getHeader(element, 'method')).to.equal('POST');
          expect(commandStack.canUndo()).to.equal(canUndo);
        }));
    }

    it('should apply missing-value migrations and report the missing target value with validation',
      inject(function(elementRegistry, elementTemplates) {
        const fields = targetTemplate.properties.map(property =>
          property.binding.name === 'endpoint' ? { ...property, value: '', optional: true } : property
        );
        const target = {
          ...targetWith([ { from: input('missing'), to: endpoint } ], fields),
          validation: [
            {
              when: { binding: endpoint, isEmpty: true },
              message: 'Configure the endpoint before deploying.'
            }
          ]
        };
        elementTemplates.set([ legacyTemplate, target ]);
        const element = elementRegistry.get('Legacy');

        elementTemplates.applyTemplate(element, target);

        expect(getInput(element, 'endpoint')).to.be.undefined;
        expect(getValidationErrors(element, target).map(error => error.message))
          .to.eql([ 'Configure the endpoint before deploying.' ]);
      }));

    it('should reset a hidden value to the template default on update',
      inject(async function(bpmnjs, elementRegistry, elementTemplates) {
        const fields = targetTemplate.properties.map(property =>
          property.binding.name === 'endpoint' ? { ...property, type: 'Hidden' } : property
        );
        const target = targetWith([ { ...copy, includeHidden: true } ], fields);
        elementTemplates.set([ legacyTemplate, target ]);
        let element = elementRegistry.get('Legacy');

        elementTemplates.applyTemplate(element, target);

        expect(getInput(element, 'endpoint')).to.equal('https://custom.io');

        await bpmnjs.importXML((await bpmnjs.saveXML()).xml);
        element = elementRegistry.get('Legacy');
        const updated = {
          ...target, version: 2,
          properties: fields.map(property =>
            property.binding.name === 'endpoint' ? { ...property, value: 'new endpoint default' } : property
          )
        };
        elementTemplates.set([ legacyTemplate, target, updated ]);
        elementTemplates.applyTemplate(element, updated);

        expect(getInput(element, 'endpoint')).to.equal('new endpoint default');
      }));

    it('should apply a new default when the stored value matched the old default',
      inject(function(elementRegistry, elementTemplates) {
        const fields = targetTemplate.properties.map(property =>
          property.binding.name === 'timeout' ? { ...property, value: 'PT1M' } : property
        );
        const target = targetWith([], fields);
        elementTemplates.set([ legacyTemplate, target ]);
        const element = elementRegistry.get('Legacy');
        elementTemplates.applyTemplate(element, target);
        const updated = {
          ...target, version: 2,
          properties: fields.map(property =>
            property.binding.name === 'timeout' ? { ...property, value: 'PT2M' } : property
          )
        };
        elementTemplates.set([ legacyTemplate, target, updated ]);

        elementTemplates.applyTemplate(element, updated);

        expect(getInput(element, 'timeout')).to.equal('PT2M');
      }));

    it('should apply an explicit preset',
      inject(function(elementRegistry, elementTemplates) {
        const fields = targetTemplate.properties.map(property =>
          property.binding.name === 'timeout' ? { ...property, id: 'timeout' } : property
        );
        const target = {
          ...targetWith([], fields),
          presets: [ { id: 'reset', name: 'Reset', properties: { timeout: 'PT5M' } } ]
        };
        elementTemplates.set([ legacyTemplate, target ]);
        const element = elementRegistry.get('Legacy');
        elementTemplates.applyTemplate(element, target);
        expect(getInput(element, 'timeout')).to.equal('PT1M');

        elementTemplates.applyTemplate(element, target, { presetId: 'reset' });

        expect(getInput(element, 'timeout')).to.equal('PT5M');
      }));
  });


  describe('versioned steps', function() {

    const input = name => ({ type: 'zeebe:input', name });
    const endpoint = input('endpoint');
    const intermediate = input('intermediate');
    const steps = [
      {
        toVersion: 4,
        minSourceVersion: 2,
        changes: 'Use the staged endpoint.',
        properties: [ {
          when: { binding: intermediate, equals: 'https://custom.io' },
          from: intermediate,
          to: endpoint
        } ]
      },
      {
        toVersion: 2,
        changes: 'Stage the legacy URL.',
        properties: [ { from: input('url'), to: intermediate } ]
      },
      { toVersion: 5, properties: [ { to: endpoint, set: 'not yet' } ] }
    ];

    it('should run same-ID steps in order without loading intermediate templates and undo once',
      inject(function(elementRegistry, elementTemplates, commandStack) {
        const target = { ...targetTemplate, id: legacyTemplate.id, version: 4, migratesFrom: steps };
        elementTemplates.set([ legacyTemplate, target ]);

        const element = elementRegistry.get('Legacy');

        expect(elementTemplates.getMigrations(element)).to.eql([]);
        expect(elementTemplates.getChanges(element, target)).to.equal('Stage the legacy URL.\n\nUse the staged endpoint.');

        elementTemplates.applyTemplate(element, target);

        expect(getInput(element, 'endpoint')).to.equal('https://custom.io');
        expect(getInput(element, 'intermediate')).to.be.undefined;
        commandStack.undo();
        expect(elementTemplates.get(element)).to.equal(legacyTemplate);
        expect(getInput(element, 'url')).to.equal('https://custom.io');
      }));

    it('should enforce the change minimum and continue above the landing version',
      inject(function(elementRegistry, elementTemplates) {
        const change = {
          sourceTemplateId: legacyTemplate.id,
          minSourceVersion: 1,
          toVersion: 2,
          description: 'Migrate to the new REST template.',
          properties: [ { from: input('url'), to: intermediate } ]
        };
        const target = { ...targetTemplate, version: 4, migratesFrom: [ ...steps, change ] };
        elementTemplates.set([ legacyTemplate, target ]);

        const element = elementRegistry.get('Legacy');

        expect(elementTemplates.getMigrations(element)).to.eql([ target ]);
        expect(elementTemplates.getMigrationDescription(element, target)).to.equal(change.description);
        expect(elementTemplates.getChanges(element, { ...target, migratesFrom: [
          ...steps, { ...change, minSourceVersion: 2 }
        ] })).to.be.undefined;

        elementTemplates.applyTemplate(element, target);

        expect(getInput(element, 'endpoint')).to.equal('https://custom.io');
      }));

    it('should enforce the change maximum',
      inject(function(elementRegistry, elementTemplates) {
        const change = { sourceTemplateId: legacyTemplate.id, maxSourceVersion: 1, toVersion: 2, properties: [] };
        const target = { ...targetTemplate, version: 2, migratesFrom: [ change ] };
        const element = elementRegistry.get('Legacy');

        elementTemplates.set([ legacyTemplate, target ]);
        expect(elementTemplates.getMigrations(element)).to.eql([ target ]);

        elementTemplates.set([ legacyTemplate, { ...target, migratesFrom: [ { ...change, maxSourceVersion: 0 } ] } ]);
        expect(elementTemplates.getMigrations(element)).to.eql([]);
      }));

    it('should apply the REST example for v1 and skip historical rules for v17',
      inject(function(elementRegistry, elementTemplates) {
        const method = input('method');
        const choices = values => values.map(value => ({ name: value, value }));
        const header = key => ({ type: 'zeebe:taskHeader', key });
        const retryBackoff = { label: 'Retry backoff', type: 'String', binding: header('retryBackoff'), value: 'PT30S' };
        const resultExpression = { label: 'Result', type: 'Text', binding: header('resultExpression'), value: '=response' };
        const source = {
          ...legacyTemplate,
          properties: [ { label: 'Method', type: 'Dropdown', binding: method, choices: choices([ 'post' ]) } ]
        };
        const target = {
          ...source,
          version: 18,
          migratesFrom: restSteps,
          properties: [
            { label: 'Method', type: 'Dropdown', binding: method, choices: choices([ 'GET', 'POST' ]) },
            retryBackoff,
            resultExpression
          ]
        };
        const recent = { ...target, version: 17 };
        elementTemplates.set([ source, recent, target ]);

        const oldElement = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), source);
        elementTemplates.applyTemplate(oldElement, target);

        expect(getInput(oldElement, 'method')).to.equal('POST');
        expect(getHeader(oldElement, 'retryBackoff')).to.equal('PT0S');
        expect(getHeader(oldElement, 'resultExpression')).to.be.undefined;

        const recentElement = elementTemplates.applyTemplate(elementRegistry.get('Unknown'), recent);
        elementTemplates.applyTemplate(recentElement, target);

        expect(getHeader(recentElement, 'retryBackoff')).to.equal('PT30S');
        expect(getHeader(recentElement, 'resultExpression')).to.equal('=response');
      }));

  });


  describe('#getMigrations', function() {

    it('should return declared migration', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Legacy'));

      // then
      expect(migrations).to.eql([ targetTemplate ]);
    }));


    it('should return nothing for template that is not loaded', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Unknown'));

      // then
      expect(migrations).to.be.empty;
    }));


    it('should return nothing for migration target', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Current'));

      // then
      expect(migrations).to.be.empty;
    }));

  });


  describe('#getChanges', function() {

    it('should return migration changes', inject(function(elementRegistry, elementTemplates) {

      // when
      const changes = elementTemplates.getChanges(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(changes).to.eql(targetTemplate.migratesFrom[0].changes);
    }));


    it('should return nothing for update', inject(function(elementRegistry, elementTemplates) {

      // when
      const changes = elementTemplates.getChanges(elementRegistry.get('Current'), targetTemplate);

      // then
      expect(changes).not.to.exist;
    }));

  });


  describe('properties panel', function() {

    it('should offer migration', inject(async function(elementRegistry, selection) {

      // when
      await act(() => selection.select(elementRegistry.get('Legacy')));

      // then
      const button = domQuery('.bio-properties-panel-template-migration-available', container);

      expect(button).to.exist;

      const text = domQuery('.bio-properties-panel-template-migration-available-text', button);

      expect(text.textContent).to.eql('Migration to REST connector is available.');
    }));


    it('should request changes review', inject(async function(elementRegistry, selection, eventBus) {

      // given
      const element = elementRegistry.get('Legacy');

      const reviewSpy = spy();

      eventBus.on('elementTemplates.reviewChanges', reviewSpy);

      await act(() => selection.select(element));

      // when
      await clickMenuItem(container, 'Review changes');

      // then
      expect(reviewSpy).to.have.been.calledOnce;
      expect(reviewSpy.getCall(0).args[0]).to.include({
        element,
        newTemplate: targetTemplate,
        changes: targetTemplate.migratesFrom[0].changes
      });
    }));


    it('should migrate', inject(async function(elementRegistry, selection, elementTemplates) {

      // given
      await act(() => selection.select(elementRegistry.get('Legacy')));

      // when
      await clickMenuItem(container, 'Migrate');

      // then
      const element = elementRegistry.get('Legacy');

      expect(elementTemplates.get(element)).to.equal(targetTemplate);
      expect(getInput(element, 'endpoint')).to.eql('https://custom.io');
      expect(domQuery('.bio-properties-panel-template-migration-available', container)).not.to.exist;
    }));

  });

});


// helpers //////////

function getInput(element, name) {
  const ioMapping = findExtension(element, 'zeebe:IoMapping');

  return ioMapping && findInputParameter(ioMapping, { name })?.get('source');
}

function getHeader(element, key) {
  const taskHeaders = findExtension(element, 'zeebe:TaskHeaders');

  return taskHeaders && findTaskHeader(taskHeaders, { key })?.get('value');
}

function clickMenuItem(container, text) {
  const item = Array.from(domQueryAll('.bio-properties-panel-dropdown-button__menu-item', container))
    .find(item => item.textContent === text);

  if (!item) {
    throw new Error(`menu item <${ text }> missing`);
  }

  return click(item);
}
