// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for the typed moddle accessors
 * (default-plugins/element-template/migration/moddle.ts)
 */

import assert from 'assert';
import { getModdleElement, getModdleList, getModdleNumber, getModdleString, isModdleElement } from '../../../src/migration/moddle.js';
import { moddle } from '../moddle.js';
const WRONG_TYPES = [ [ 'undefined', undefined ], [ 'null', null ], [ 'a number', 1 ], [ 'a string', 'text' ], [ 'a boolean', true ], [ 'a plain object', {} ], [ 'an object with a non-function get', {
  get: 'x'
} ], [ 'an array', [] ] ];

describe('isModdleElement', function() {
  it('accepts an object with a get function', function() {
    assert.strictEqual(isModdleElement(moddle('a:B', {})), true);
  });
  for (const [ name, value ] of WRONG_TYPES) {
    it(`rejects ${name}`, function() {
      assert.strictEqual(isModdleElement(value), false);
    });
  }
});

describe('getModdleString and getModdleNumber', function() {
  it('return the value of the matching type', function() {
    const element = moddle('a:B', {
      text: 'x',
      count: 2
    });
    assert.strictEqual(getModdleString(element, 'text'), 'x');
    assert.strictEqual(getModdleNumber(element, 'count'), 2);
  });
  for (const [ name, value ] of WRONG_TYPES.filter(([ n ]) => n !== 'a string')) {
    it(`getModdleString ignores ${name}`, function() {
      assert.strictEqual(getModdleString(moddle('a:B', {
        v: value
      }), 'v'), undefined);
    });
  }
  for (const [ name, value ] of WRONG_TYPES.filter(([ n ]) => n !== 'a number')) {
    it(`getModdleNumber ignores ${name}`, function() {
      assert.strictEqual(getModdleNumber(moddle('a:B', {
        v: value
      }), 'v'), undefined);
    });
  }
});

describe('getModdleElement', function() {
  it('returns a moddle child and ignores anything else', function() {
    const child = moddle('a:C', {});
    assert.strictEqual(getModdleElement(moddle('a:B', {
      c: child
    }), 'c'), child);
    for (const [ name, value ] of WRONG_TYPES) {
      assert.strictEqual(getModdleElement(moddle('a:B', {
        c: value
      }), 'c'), undefined, name);
    }
  });
});

describe('getModdleList', function() {
  it('returns the moddle elements of a collection', function() {
    const a = moddle('a:C', {});
    const b = moddle('a:D', {});
    assert.deepStrictEqual(getModdleList(moddle('a:B', {
      list: [ a, b ]
    }), 'list'), [ a, b ]);
  });

  it('drops entries that are not moddle elements', function() {
    const a = moddle('a:C', {});
    assert.deepStrictEqual(getModdleList(moddle('a:B', {
      list: [ a, 1, 'x', null, {} ]
    }), 'list'), [ a ]);
  });

  it('is empty for an absent element, a missing property or a non-array', function() {
    assert.deepStrictEqual(getModdleList(undefined, 'list'), []);
    assert.deepStrictEqual(getModdleList(moddle('a:B', {}), 'list'), []);
    assert.deepStrictEqual(getModdleList(moddle('a:B', {
      list: 'x'
    }), 'list'), []);
  });
});
