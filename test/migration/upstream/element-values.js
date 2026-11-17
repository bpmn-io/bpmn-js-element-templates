// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for reading element values off a BPMN extension tree
 * (default-plugins/element-template/migration/element-values.ts)
 */

import assert from 'assert';
import { enumerateElementValues, getExtensionElements } from '../../../src/migration/element-values.js';
import { extensionElements, moddle } from '../moddle.js';

describe('enumerateElementValues', function() {
  const ext = extensionElements(moddle('zeebe:IoMapping', {
    inputParameters: [ moddle('zeebe:Input', {
      target: 'url',
      source: 'https://x'
    }), moddle('zeebe:Input', {
      target: 'body',
      source: '=payload'
    }) ],
    outputParameters: [ moddle('zeebe:Output', {
      source: '=response',
      target: 'result'
    }) ]
  }), moddle('zeebe:TaskHeaders', {
    values: [ moddle('zeebe:Header', {
      key: 'k',
      value: 'v'
    }) ]
  }), moddle('zeebe:TaskDefinition', {
    type: 'io.example',
    retries: 3
  }), moddle('zeebe:AgentDefinition', {
    agentType: 'ai'
  }), moddle('zeebe:AdHoc', {
    outputCollection: 'results'
  }));

  it('reads values keyed by binding and flags FEEL values', function() {
    const values = enumerateElementValues(ext);
    const byKey = (type, key) => values.find(v => v.bindingType === type && v.key === key);
    assert.strictEqual(byKey('zeebe:input', 'url')?.value, 'https://x');
    assert.strictEqual(byKey('zeebe:input', 'body')?.isFeel, true);
    assert.strictEqual(byKey('zeebe:output', '=response')?.value, 'result');
    assert.strictEqual(byKey('zeebe:taskHeader', 'k')?.value, 'v');
    assert.strictEqual(byKey('zeebe:taskDefinition', 'retries')?.value, '3');
    assert.strictEqual(byKey('zeebe:agentDefinition', 'agentType')?.value, 'ai');
    assert.strictEqual(byKey('zeebe:adHoc', 'outputCollection')?.value, 'results');
  });

  it('never reports the task definition type', function() {
    assert.ok(!enumerateElementValues(ext).some(v => v.bindingType === 'zeebe:taskDefinition' && v.key === 'type'));
  });

  it('returns nothing for an element without extensions', function() {
    assert.deepStrictEqual(enumerateElementValues(undefined), []);
  });
});

describe('getExtensionElements', function() {
  it('returns the extensionElements child', function() {
    const ext = extensionElements();
    assert.strictEqual(getExtensionElements(moddle('bpmn:Task', {
      extensionElements: ext
    })), ext);
  });

  it('returns undefined when there is none or it is not a moddle element', function() {
    assert.strictEqual(getExtensionElements(moddle('bpmn:Task', {})), undefined);
    assert.strictEqual(getExtensionElements(moddle('bpmn:Task', {
      extensionElements: 'not an element'
    })), undefined);
  });
});
