// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for the migration engine's binding and element-value helpers
 * (default-plugins/element-template/migration/)
 */

import assert from 'assert';
import { bindingPath, bindingTargetKey, findExtensionContainers, findPropertiesByTarget, maybePrependFeel, resolveBindingTarget, splitBindingPrefix } from '../../../src/migration/binding.js';
import { extensionElements, moddle } from '../moddle.js';

describe('splitBindingPrefix', function() {
  it('splits a known prefix and leaves other colons alone', function() {
    assert.deepStrictEqual(splitBindingPrefix('input:a.b'), {
      bindingType: 'zeebe:input',
      key: 'a.b'
    });
    assert.deepStrictEqual(splitBindingPrefix('header:k'), {
      bindingType: 'zeebe:taskHeader',
      key: 'k'
    });
    assert.deepStrictEqual(splitBindingPrefix('urn:x'), {
      bindingType: null,
      key: 'urn:x'
    });
    assert.deepStrictEqual(splitBindingPrefix('plain'), {
      bindingType: null,
      key: 'plain'
    });
  });
});

describe('bindingTargetKey and findPropertiesByTarget', function() {
  const properties = [ {
    binding: {
      type: 'zeebe:input',
      name: 'url'
    }
  }, {
    binding: {
      type: 'zeebe:taskHeader',
      key: 'url'
    }
  }, {
    binding: {
      type: 'zeebe:output',
      source: '= result'
    }
  }, {
    binding: {
      type: 'zeebe:agentDefinition',
      property: 'agentType'
    }
  }, {
    binding: {
      type: 'unknown:thing',
      name: 'x'
    }
  } ];

  it('derives the key per binding type', function() {
    assert.deepStrictEqual(properties.map(p => bindingTargetKey(p.binding)), [ 'url', 'url', '= result', 'agentType', undefined ]);
  });

  it('filters by binding type when given', function() {
    assert.strictEqual(findPropertiesByTarget(properties, 'url', null).length, 2);
    assert.strictEqual(findPropertiesByTarget(properties, 'url', 'zeebe:taskHeader').length, 1);
  });
});

describe('maybePrependFeel', function() {
  it('prepends = only for feel: required values that lack it', function() {
    assert.strictEqual(maybePrependFeel({
      feel: 'required'
    }, 'x'), '=x');
    assert.strictEqual(maybePrependFeel({
      feel: 'required'
    }, '=x'), '=x');
    assert.strictEqual(maybePrependFeel({
      feel: 'required'
    }, ''), '');
    assert.strictEqual(maybePrependFeel({
      feel: 'optional'
    }, 'x'), 'x');
    assert.strictEqual(maybePrependFeel({}, 'x'), 'x');
  });
});

describe('resolveBindingTarget', function() {
  const containers = findExtensionContainers(extensionElements(moddle('zeebe:IoMapping', {
    inputParameters: [ moddle('zeebe:Input', {
      target: 'url',
      source: 's'
    }) ]
  }), moddle('zeebe:AdHoc', {
    outputCollection: 'r'
  })));

  it('resolves existing entries and skips missing ones', function() {
    const input = resolveBindingTarget({
      type: 'zeebe:input',
      name: 'url'
    }, containers);
    assert.strictEqual(input?.property, 'source');
    assert.strictEqual(resolveBindingTarget({
      type: 'zeebe:input',
      name: 'nope'
    }, containers), undefined);
    assert.strictEqual(resolveBindingTarget({
      type: 'zeebe:adHoc',
      property: 'outputCollection'
    }, containers)?.property, 'outputCollection');
    assert.strictEqual(resolveBindingTarget({
      type: 'zeebe:taskHeader',
      key: 'k'
    }, containers), undefined);
  });
});

describe('bindingPath', function() {
  for (const [ bindingType, expected ] of [ [ 'zeebe:input', 'input:key' ], [ 'zeebe:output', 'output:key' ], [ 'zeebe:taskHeader', 'header:key' ], [ 'zeebe:property', 'property:key' ], [ 'zeebe:taskDefinition', 'taskDefinition:key' ], [ 'custom', 'custom:key' ] ]) {
    it(`qualifies ${bindingType} as ${expected}`, function() {
      assert.strictEqual(bindingPath(bindingType, 'key'), expected);
    });
  }

  // Pinned: an unknown binding type yields a path no recipe can address.
  for (const bindingType of [ null, undefined ]) {
    it(`a ${bindingType} binding type yields "undefined:key"`, function() {
      assert.strictEqual(bindingPath(bindingType, 'key'), 'undefined:key');
    });
  }
});
