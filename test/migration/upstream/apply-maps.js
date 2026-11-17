// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * `--map` value moves applied after the step chain
 * (default-plugins/element-template/migration/apply.ts)
 */

import assert from 'assert';
import { migrateElement } from '../../../src/migration/apply.js';
import { enumerateElementValues, getExtensionElements } from '../../../src/migration/element-values.js';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { cleanup, input, loadVendorBundle, setupAppliedModeler } from '../helper.js';
let vendor;

function setup(applied, values) {
  return setupAppliedModeler(vendor, applied, values);
}
const hidden = id => ({
  type: 'Hidden',
  value: id,
  binding: {
    type: 'zeebe:taskDefinition',
    property: 'type'
  }
});
const OLD = {
  id: 'io.example.old',
  version: 1,
  name: 'Old',
  appliesTo: [ 'bpmn:Task' ],
  properties: [ hidden('io.example.old'), input('maxTokens', '') ]
};
const NEW = {
  id: 'io.example.new',
  version: 1,
  name: 'New',
  appliesTo: [ 'bpmn:Task' ],
  properties: [ hidden('io.example.new'), input('limit', ''), input('mode', 'off', {
    id: 'mode'
  }), input('extra', '', {
    condition: {
      property: 'mode',
      equals: 'on'
    }
  }) ]
};
const valueAt = (migrated, key) => enumerateElementValues(getExtensionElements(migrated.businessObject)).find(v => v.key === key)?.value;
const run = async (maps, values = {
  maxTokens: '512'
}, recipe, target = NEW) => {
  const {
    migrationModeler,
    element
  } = await setup(OLD, values);
  return migrateElement({
    modeler: migrationModeler,
    element,
    fromTemplate: OLD,
    target,
    templates: [ OLD, target ],
    recipe,
    maps
  });
};
const map = (from, to) => ({
  from: {
    key: from,
    bindingType: null
  },
  to: {
    key: to,
    bindingType: null
  }
});

describe('migrateElement maps', function() {
  before(function() {
    vendor = loadVendorBundle();
  });

  afterEach(cleanup);

  it('moves a dropped value, losslessly', async function() {
    const {
      element,
      report
    } = await run([ map('maxTokens', 'limit') ]);
    assert.strictEqual(valueAt(element, 'limit'), '512');
    assert.strictEqual(report.dropped.length, 0);
    assert.strictEqual(report.lossless, true);
    assert.strictEqual(report.moved[0].from.key, 'maxTokens');
    assert.strictEqual(report.moved[0].to.key, 'limit');
  });

  it('reports a mapped destination as moved only', async function() {
    const {
      report
    } = await run([ map('maxTokens', 'limit') ]);
    assert.deepStrictEqual(report.added.map(a => a.key), [ 'mode' ]);
    assert.strictEqual(report.moved.length, 1);
  });

  it('without the map the value is dropped', async function() {
    const {
      report
    } = await run([]);
    assert.strictEqual(report.dropped.length, 1);
    assert.strictEqual(report.lossless, false);
  });

  it('skips a source that holds no value', async function() {
    const {
      element,
      report
    } = await run([ map('maxTokens', 'limit') ], {});
    assert.strictEqual(valueAt(element, 'limit') ?? '', '');
    assert.strictEqual(report.moved.length, 0);
    assert.strictEqual(report.lossless, true);
  });

  it('materializes a binding whose condition the moved value satisfies', async function() {
    const old = {
      ...OLD,
      properties: [ hidden(OLD.id), input('flag', '') ]
    };
    const {
      migrationModeler,
      element: el
    } = await setup(old, {
      flag: 'on'
    });
    const result = migrateElement({
      modeler: migrationModeler,
      element: el,
      fromTemplate: old,
      target: NEW,
      templates: [ old, NEW ],
      maps: [ map('flag', 'mode'), map('flag', 'extra') ]
    });
    assert.strictEqual(valueAt(result.element, 'extra'), 'on');
  });

  it('keeps a conditional binding absent when the moved value does not satisfy its condition', async function() {
    const old = {
      ...OLD,
      properties: [ hidden(OLD.id), input('flag', '') ]
    };
    const {
      migrationModeler,
      element: el
    } = await setup(old, {
      flag: 'off'
    });
    const result = migrateElement({
      modeler: migrationModeler,
      element: el,
      fromTemplate: old,
      target: NEW,
      templates: [ old, NEW ],
      maps: [ map('flag', 'mode'), map('flag', 'extra') ]
    });
    assert.strictEqual(valueAt(result.element, 'mode'), 'off');
    assert.strictEqual(valueAt(result.element, 'extra'), undefined);

    // The Modeler removes the inactive binding, so the flag->extra move vanishes
    // and the lost value is listed as dropped.
    assert.deepStrictEqual(result.report.dropped.map(d => [ d.key, d.value ]), [ [ 'flag', 'off' ] ]);
    assert.deepStrictEqual(result.report.moved.map(m => [ m.from.key, m.to.key ]), [ [ 'flag', 'mode' ] ]);
    assert.strictEqual(result.report.lossless, false);
  });

  it('fails on a destination the target does not bind and lists names', async function() {
    await assert.rejects(() => run([ map('maxTokens', 'nope') ]), /destination "nope".*Available: .*limit/);
  });

  it('fails on a source the source template does not bind', async function() {
    await assert.rejects(() => run([ map('nope', 'limit') ]), /source "nope".*Available: .*maxTokens/);
  });

  it('fails when a recipe entry also writes the destination', async function() {
    const recipe = parseRecipe({
      schemaVersion: 1,
      sources: [ {
        kind: 'change',
        sourceTemplateId: OLD.id,
        paths: [ {
          to: 'limit',
          set: '1'
        } ]
      } ]
    });
    await assert.rejects(() => run([ map('maxTokens', 'limit') ], undefined, recipe), /Ambiguous migration/);
  });

  it('fails when two maps write the same destination', async function() {
    await assert.rejects(() => run([ map('maxTokens', 'limit'), map('maxTokens', 'limit') ]), /Ambiguous migration/);
  });

  it('rejects a destination the target binds only as Hidden', async function() {
    const target = {
      ...NEW,
      properties: [ ...NEW.properties, {
        type: 'Hidden',
        value: 'fixed',
        binding: {
          type: 'zeebe:input',
          name: 'locked'
        }
      } ]
    };
    await assert.rejects(() => run([ map('maxTokens', 'locked') ], undefined, undefined, target), /destination "locked" is not a settable binding/);
  });

  it('stores a moved value as a FEEL expression when the destination requires FEEL', async function() {
    const target = {
      ...NEW,
      properties: [ hidden(NEW.id), input('limit', '', {
        feel: 'required'
      }) ]
    };
    const {
      element,
      report
    } = await run([ map('maxTokens', 'limit') ], undefined, undefined, target);
    assert.strictEqual(valueAt(element, 'limit'), '=512');
    assert.strictEqual(report.lossless, true);
    assert.deepStrictEqual(report.dropped, []);
  });

  it('a map reads the original value after a multi-step chain removed its field', async function() {
    const id = 'io.example.chain';
    const v1 = {
      id,
      version: 1,
      appliesTo: [ 'bpmn:Task' ],
      properties: [ hidden(id), input('a', '') ]
    };
    const v2 = {
      ...v1,
      version: 2,
      properties: [ hidden(id), input('b', '') ]
    };
    const v3 = {
      ...v1,
      version: 3,
      properties: [ hidden(id), input('c', ''), input('d', '') ],
      metadata: {
        migratesFrom: {
          schemaVersion: 1,
          sources: [ {
            kind: 'upgrade',
            sourceTemplateId: id,
            toVersion: 2,
            paths: [ {
              from: 'a',
              to: 'b'
            } ]
          }, {
            kind: 'upgrade',
            sourceTemplateId: id,
            toVersion: 3,
            paths: [ {
              from: 'b',
              to: 'c'
            } ]
          } ]
        }
      }
    };
    const {
      migrationModeler,
      element
    } = await setupAppliedModeler(vendor, v1, {
      a: 'original'
    });
    const result = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: v1,
      target: v3,
      templates: [ v1, v2, v3 ],
      maps: [ map('a', 'd') ]
    });
    assert.strictEqual(valueAt(result.element, 'c'), 'original');
    assert.strictEqual(valueAt(result.element, 'd'), 'original');
    assert.deepStrictEqual(result.report.dropped, []);
  });
});
