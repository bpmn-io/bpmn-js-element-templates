// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * MIG-008, engine half: ambiguous source reads are rejected
 * (default-plugins/element-template/migration/plan.ts)
 */

import { strict as assert } from 'assert';
import simpleXML from '../simple.bpmn';
import { migrateElement } from '../../../src/migration/apply.js';
import { enumerateElementValues, getExtensionElements } from '../../../src/migration/element-values.js';
import { buildStepPlan } from '../../../src/migration/plan.js';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { cleanup, createTestModeler, loadVendorBundle } from '../helper.js';
function value(bindingType, key, text) {
  return {
    bindingType,
    key,
    value: text,
    isFeel: text.startsWith('=')
  };
}
function entries(...paths) {
  return parseRecipe({
    schemaVersion: 1,
    sources: [ {
      kind: 'change',
      sourceTemplateId: 'old',
      paths
    } ]
  }).sources[0].entries;
}
const INPUT = 'zeebe:input';
const HEADER = 'zeebe:taskHeader';
const COLLISIONS = [ value(INPUT, 'key', 'INPUT_VALUE'), value(HEADER, 'key', 'HEADER_VALUE') ];
const GUARDS = [ {
  exists: true
}, {
  exists: false
}, {
  equals: 'INPUT_VALUE'
}, {
  equals: 'INPUT_VALUE',
  not: true
}, {
  matches: 'INPUT*'
}, {
  matches: 'INPUT*',
  not: true
}, {
  in: [ 'INPUT_VALUE' ]
}, {
  in: [ 'INPUT_VALUE' ],
  not: true
} ];

describe('migration source-read identity', function() {
  for (const [ prefix, type ] of [ [ 'input', INPUT ], [ 'output', 'zeebe:output' ], [ 'header', HEADER ], [ 'property', 'zeebe:property' ], [ 'taskDefinition', 'zeebe:taskDefinition' ], [ 'agentDefinition', 'zeebe:agentDefinition' ], [ 'adHoc', 'zeebe:adHoc' ] ]) {
    it(`diagnostic ${prefix} qualification is usable for every source-read form`, function() {
      const values = [ value(type, 'key', 'SELECTED'), value(type === INPUT ? HEADER : INPUT, 'key', 'OTHER') ];
      for (const rule of [ {
        from: 'key',
        to: 'result'
      }, {
        template: '${key}',
        to: 'result'
      }, {
        when: {
          path: 'key',
          exists: true
        },
        to: 'result',
        set: 'SELECTED'
      } ]) {
        assert.throws(() => buildStepPlan(entries(rule), values), error => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Ambiguous source path/);
          assert.ok(error.message.includes(`${prefix}:key`));
          assert.doesNotMatch(error.message, /SELECTED|OTHER/);
          return true;
        });
      }
      for (const rule of [ {
        from: `${prefix}:key`,
        to: 'result'
      }, {
        template: `\${${prefix}:key}`,
        to: 'result'
      }, {
        when: {
          path: `${prefix}:key`,
          equals: 'SELECTED'
        },
        to: 'result',
        set: 'SELECTED'
      } ]) {
        assert.equal(buildStepPlan(entries(rule), values).writes[0]?.value, 'SELECTED');
      }
    });
  }
  for (const active of [ true, false ]) {
    it(`deep nested interpolation rejects collisions even with active=${active} inherited guards`, function() {
      for (const values of [ COLLISIONS, [ ...COLLISIONS ].reverse() ]) {
        const path = {
          when: {
            path: 'input:key',
            equals: active ? 'INPUT_VALUE' : 'missing'
          },
          rules: [ {
            when: {
              path: 'header:key',
              exists: true
            },
            rules: [ {
              to: 'result',
              template: '${input:key}/${key}/${header:key}'
            } ]
          } ]
        };
        assert.throws(() => buildStepPlan(entries(path), values), /Ambiguous source path "key"/);
      }
    });
  }
  for (const [ form, path ] of [ [ 'rename', {
    from: 'key',
    to: 'result'
  } ], [ 'interpolation', {
    template: '${key}/${key}',
    to: 'result'
  } ], [ 'nested interpolation', {
    when: {
      path: 'input:key',
      exists: true
    },
    rules: [ {
      template: '${key}',
      to: 'result'
    } ]
  } ] ]) {
    it(`rejects unqualified ${form} collisions independently of backing order`, function() {
      for (const values of [ COLLISIONS, [ ...COLLISIONS ].reverse() ]) {
        assert.throws(() => buildStepPlan(entries(path), values), error => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Ambiguous source path "key"/);
          assert.ok(error.message.includes('input:key'));
          assert.ok(error.message.includes('header:key'));
          assert.doesNotMatch(error.message, /INPUT_VALUE|HEADER_VALUE/);
          return true;
        });
      }
    });
  }
  for (const guard of GUARDS) {
    it(`rejects ambiguous leaf and nested guard reads ${JSON.stringify(guard)}`, function() {
      for (const values of [ COLLISIONS, [ ...COLLISIONS ].reverse() ]) {
        for (const path of [ {
          to: 'result',
          set: 'static',
          when: {
            path: 'key',
            ...guard
          }
        }, {
          when: {
            path: 'key',
            ...guard
          },
          rules: [ {
            to: 'result',
            set: 'static'
          } ]
        } ]) {
          assert.throws(() => buildStepPlan(entries(path), values), /Ambiguous source path "key".*(?:input:key.*header:key|header:key.*input:key)/);
        }
      }
    });
  }
  for (const [ prefix, type, text ] of [ [ 'input', INPUT, 'INPUT_VALUE' ], [ 'header', HEADER, 'HEADER_VALUE' ] ]) {
    it(`qualified ${prefix} reads select only that binding for every source-read form`, function() {
      for (const values of [ COLLISIONS, [ ...COLLISIONS ].reverse() ]) {
        const rename = buildStepPlan(entries({
          from: `${prefix}:key`,
          to: 'input:result'
        }), values);
        assert.equal(rename.writes[0]?.value, text);
        assert.deepEqual(rename.facts.moved[0]?.from, {
          key: 'key',
          bindingType: type
        });
        assert.equal(buildStepPlan(entries({
          to: 'result',
          template: `\${${prefix}:key}/\${${prefix}:key}`
        }), values).writes[0]?.value, `${text}/${text}`);
        for (const guard of [ {
          exists: true
        }, {
          equals: text
        }, {
          matches: `${prefix.toUpperCase()}*`
        }, {
          in: [ text ]
        }, {
          equals: 'missing',
          not: true
        }, {
          matches: 'missing*',
          not: true
        }, {
          in: [ 'missing' ],
          not: true
        } ]) {
          assert.equal(buildStepPlan(entries({
            when: {
              path: `${prefix}:key`,
              ...guard
            },
            rules: [ {
              to: 'result',
              set: 'active'
            } ]
          }), values).writes[0]?.value, 'active');
        }
        assert.deepEqual(buildStepPlan(entries({
          to: 'result',
          set: 'inactive',
          when: {
            path: `${prefix}:key`,
            equals: prefix === 'input' ? 'HEADER_VALUE' : 'INPUT_VALUE'
          }
        }), values).writes, []);
      }
    });
  }

  it('unqualified unique reads and explicitly mixed interpolation remain valid', function() {
    for (const source of COLLISIONS) {
      assert.equal(buildStepPlan(entries({
        from: 'key',
        to: 'result'
      }), [ source ]).writes[0]?.value, source.value);
      assert.equal(buildStepPlan(entries({
        template: '${key}',
        to: 'result'
      }), [ source ]).writes[0]?.value, source.value);
    }
    assert.equal(buildStepPlan(entries({
      template: '${input:key}/${header:key}',
      to: 'result'
    }), COLLISIONS).writes[0]?.value, 'INPUT_VALUE/HEADER_VALUE');
  });
  for (const [ prefix, type ] of [ [ 'input', INPUT ], [ 'header', HEADER ], [ 'output', 'zeebe:output' ], [ 'property', 'zeebe:property' ] ]) {
    it(`duplicate ${prefix} backing entries reject every read, even with equal or empty values`, function() {
      for (const text of [ 'SECOND_VALUE', 'FIRST_VALUE', '' ]) {
        const values = [ value(type, 'key', 'FIRST_VALUE'), value(type, 'key', text) ];
        for (const path of [ 'key', `${prefix}:key` ]) {
          for (const rule of [ {
            from: path,
            to: 'result'
          }, {
            template: `\${${path}}`,
            to: 'result'
          }, ...GUARDS.map(guard => ({
            to: 'result',
            set: 'static',
            when: {
              path,
              ...guard
            }
          })) ]) {
            assert.throws(() => buildStepPlan(entries(rule), values), error => {
              assert.ok(error instanceof Error);
              assert.match(error.message, /Duplicate source path/);
              assert.ok(error.message.includes(`${prefix}:key`));
              assert.match(error.message, /removing duplicate backing entries/);
              assert.doesNotMatch(error.message, /FIRST_VALUE|SECOND_VALUE/);
              return true;
            });
          }
        }
      }
    });
  }

  it('qualification isolates valid input reads from duplicate header backing entries', function() {
    const values = [ ...COLLISIONS, value(HEADER, 'key', 'OTHER_HEADER') ];
    assert.equal(buildStepPlan(entries({
      from: 'input:key',
      to: 'result'
    }), values).writes[0]?.value, 'INPUT_VALUE');
    assert.throws(() => buildStepPlan(entries({
      from: 'header:key',
      to: 'result'
    }), values), /Duplicate source/);
  });
});
function property(type, key) {
  return {
    type: 'String',
    value: '',
    label: `${type}:${key}`,
    binding: type === HEADER ? {
      type,
      key
    } : {
      type,
      name: key
    }
  };
}
function template(id, version, properties, sources) {
  return {
    id,
    version,
    name: id,
    appliesTo: [ 'bpmn:Task' ],
    properties,
    ...(sources ? {
      metadata: {
        migratesFrom: {
          schemaVersion: 1,
          sources
        }
      }
    } : {})
  };
}
async function setup(applied, values, separateContainers = false) {
  const vendor = loadVendorBundle();
  const inputs = values.filter(item => item.bindingType === INPUT).map(item => `<zeebe:input target="${item.key}" source="${item.value}" />`).join('');
  const headers = values.filter(item => item.bindingType === HEADER).map(item => `<zeebe:header key="${item.key}" value="${item.value}" />`).join('');
  const extensions = typeof separateContainers === 'string' ? separateContainers : separateContainers ? values.map(item => item.bindingType === INPUT ? `<zeebe:ioMapping><zeebe:input target="${item.key}" source="${item.value}" /></zeebe:ioMapping>` : `<zeebe:taskHeaders><zeebe:header key="${item.key}" value="${item.value}" /></zeebe:taskHeaders>`).join('') : `<zeebe:ioMapping>${inputs}</zeebe:ioMapping><zeebe:taskHeaders>${headers}</zeebe:taskHeaders>`;
  const xml = simpleXML.replace('<bpmn:definitions ', '<bpmn:definitions xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" ').replace('<bpmn:task id="Activity_17s7axj" name="Do Something">', `<bpmn:task id="Activity_17s7axj" name="Do Something" zeebe:modelerTemplate="${applied.id}" zeebe:modelerTemplateVersion="${applied.version}"><bpmn:extensionElements>${extensions}</bpmn:extensionElements>`);
  const modeler = await createTestModeler(vendor, xml);
  const element = modeler.get('elementRegistry').get('Activity_17s7axj');
  assert.ok(element);
  return {
    modeler,
    element,
    migrationModeler: {
      elementTemplates: modeler.get('elementTemplates'),
      modeling: modeler.get('modeling')
    }
  };
}

describe('migration cross-type lineage and malformed BPMN', function() {
  afterEach(cleanup);

  for (const [ prefix, container, populated, missing ] of [ [ 'input', 'ioMapping', '<zeebe:input target="key" source="PRIVATE_VALUE" />', '<zeebe:input target="key" />' ], [ 'output', 'ioMapping', '<zeebe:output source="key" target="PRIVATE_VALUE" />', '<zeebe:output source="key" />' ], [ 'header', 'taskHeaders', '<zeebe:header key="key" value="PRIVATE_VALUE" />', '<zeebe:header key="key" />' ], [ 'property', 'properties', '<zeebe:property name="key" value="PRIVATE_VALUE" />', '<zeebe:property name="key" />' ] ]) {
    it(`rejects duplicate ${prefix} identities even when backing values are absent`, async function() {
      for (const children of [ populated + populated, populated + missing, missing + populated, missing + missing ]) {
        const old = template('old', 1, []);
        const target = template('new', 1, []);
        const {
          modeler,
          migrationModeler,
          element
        } = await setup(old, [], `<zeebe:${container}>${children}</zeebe:${container}>`);
        const before = (await modeler.saveXML({
          format: true
        })).xml;
        let mutations = 0;
        const reject = action => assert.throws(action, error => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Duplicate.*(?:source|backing)/i);
          assert.doesNotMatch(error.message, /PRIVATE_VALUE/);
          return true;
        });
        reject(() => enumerateElementValues(getExtensionElements(element.businessObject)));
        reject(() => migrateElement({
          modeler: {
            elementTemplates: {
              set: () => {
                mutations++;
              },
              applyTemplate: () => {
                mutations++;
                return element;
              }
            },
            modeling: {
              updateModdleProperties: (...args) => {
                mutations++;
                migrationModeler.modeling.updateModdleProperties(...args);
              }
            }
          },
          element,
          fromTemplate: old,
          target,
          templates: [ old, target ]
        }));
        assert.equal(mutations, 0);
        assert.equal((await modeler.saveXML({
          format: true
        })).xml, before);
      }
    });
  }
  for (const container of [ 'ioMapping', 'taskHeaders', 'properties', 'taskDefinition', 'agentDefinition', 'adHoc' ]) {
    it(`rejects duplicate empty ${container} containers before reading or mutating`, async function() {
      const old = template('old', 1, []);
      const target = template('new', 1, []);
      const {
        modeler,
        migrationModeler,
        element
      } = await setup(old, [], `<zeebe:${container} /><zeebe:${container} />`);
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      assert.throws(() => enumerateElementValues(getExtensionElements(element.businessObject)), /Duplicate backing container/);
      assert.throws(() => migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ]
      }), /Duplicate backing container/);
      assert.equal((await modeler.saveXML({
        format: true
      })).xml, before);
    });
  }
  for (const [ form, path ] of [ [ 'rename', {
    from: 'key',
    to: 'input:result'
  } ], [ 'guard', {
    to: 'input:result',
    set: 'static',
    when: {
      path: 'key',
      equals: 'INPUT_VALUE'
    }
  } ], [ 'interpolation', {
    to: 'input:result',
    template: '${key}'
  } ] ]) {
    it(`ambiguous BPMN ${form} reads fail with usable qualifications before mutation`, async function() {
      const old = template('old', 1, [ property(INPUT, 'key'), property(HEADER, 'key') ]);
      const target = template('new', 1, [ property(INPUT, 'result') ], [ {
        kind: 'change',
        sourceTemplateId: 'old',
        paths: [ path ]
      } ]);
      const {
        modeler,
        migrationModeler,
        element
      } = await setup(old, COLLISIONS);
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      assert.throws(() => migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ]
      }), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Ambiguous source path "key"/);
        assert.ok(error.message.includes('input:key'));
        assert.ok(error.message.includes('header:key'));
        assert.doesNotMatch(error.message, /INPUT_VALUE|HEADER_VALUE/);
        return true;
      });
      assert.equal((await modeler.saveXML({
        format: true
      })).xml, before);
    });
  }
  for (const [ prefix, type ] of [ [ 'input', INPUT ], [ 'header', HEADER ] ]) {
    it(`rejects duplicate ${prefix} backing identities across extension containers`, async function() {
      const old = template('old', 1, [ property(type, 'key') ]);
      const target = template('new', 1, [ property(type, 'result') ], [ {
        kind: 'change',
        sourceTemplateId: 'old',
        paths: [ {
          from: `${prefix}:key`,
          to: `${prefix}:result`
        } ]
      } ]);
      const {
        modeler,
        migrationModeler,
        element
      } = await setup(old, [ value(type, 'key', 'FIRST_VALUE'), value(type, 'key', 'SECOND_VALUE') ], true);
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      assert.throws(() => migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ]
      }), /Duplicate.*(?:source|backing|container)/i);
      assert.equal((await modeler.saveXML({
        format: true
      })).xml, before);
    });
  }
  for (const reverse of [ false, true ]) {
    for (const dropOther of [ false, true ]) {
      it(`upgrade then change keeps cross-type chains distinct (reverse=${reverse}, drop=${dropOther})`, async function() {
        const old = template('old', 1, [ property(INPUT, 'a'), property(HEADER, 'a') ]);
        const paths = [ {
          from: 'input:a',
          to: 'header:b'
        }, {
          from: 'header:a',
          to: 'input:b'
        } ];
        const intermediate = template('old', 2, [ property(INPUT, 'b'), property(HEADER, 'b') ], [ {
          kind: 'upgrade',
          sourceTemplateId: 'old',
          toVersion: 2,
          paths: reverse ? [ ...paths ].reverse() : paths
        } ]);
        const hopPaths = [ {
          from: 'header:b',
          to: 'input:c'
        }, ...(dropOther ? [] : [ {
          from: 'input:b',
          to: 'header:c',
          valueMap: {
            rules: [ {
              match: 'HEADER_VALUE',
              value: 'TRANSLATED'
            } ]
          }
        } ]) ];
        const target = template('new', 1, [ property(INPUT, 'c'), ...(dropOther ? [] : [ property(HEADER, 'c') ]) ], [ {
          kind: 'change',
          sourceTemplateId: 'old',
          minSourceVersion: 2,
          paths: reverse ? [ ...hopPaths ].reverse() : hopPaths
        } ]);
        const {
          modeler,
          migrationModeler,
          element
        } = await setup(old, [ value(INPUT, 'a', 'INPUT_VALUE'), value(HEADER, 'a', 'HEADER_VALUE') ]);
        const {
          element: migrated,
          report
        } = migrateElement({
          modeler: migrationModeler,
          element,
          fromTemplate: old,
          target,
          templates: [ old, intermediate, target ]
        });
        assert.equal(report.usedRecipe, true);
        assert.equal(report.refusal, null);
        assert.deepEqual(report.moved.map(move => [ move.from.bindingType, move.from.key, move.to.bindingType, move.to.key ]).sort(), [ [ INPUT, 'a', INPUT, 'c' ], ...(dropOther ? [] : [ [ HEADER, 'a', HEADER, 'c' ] ]) ].sort());
        assert.deepEqual(report.dropped.map(item => [ item.bindingType, item.key, item.value ]), dropOther ? [ [ HEADER, 'a', 'HEADER_VALUE' ] ] : []);
        assert.deepEqual(report.added, []);
        assert.deepEqual(report.changed, []);
        assert.equal(report.lossless, !dropOther);
        if (!dropOther) assert.deepEqual(report.moved.find(move => move.from.bindingType === HEADER)?.valueChange, {
          from: 'HEADER_VALUE',
          to: 'TRANSLATED'
        });
        const expected = [ value(INPUT, 'c', 'INPUT_VALUE'), ...(dropOther ? [] : [ value(HEADER, 'c', 'TRANSLATED') ]) ];
        assert.deepEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)), expected);
        await modeler.importXML((await modeler.saveXML({
          format: true
        })).xml);
        const reread = modeler.get('elementRegistry').get('Activity_17s7axj');
        assert.ok(reread);
        assert.deepEqual(enumerateElementValues(getExtensionElements(reread.businessObject)), expected);
      });
    }
  }
  for (const [ prefix, type ] of [ [ 'input', INPUT ], [ 'header', HEADER ] ]) {
    for (const mode of [ 'rename', 'guard', 'interpolation', 'carry-over', 'replacement', 'drop' ]) {
      it(`rejects duplicate ${prefix} BPMN backing entries before ${mode} mutation`, async function() {
        const old = template('old', 1, [ property(type, 'key') ]);
        const target = template('new', 1, mode === 'drop' ? [] : [ property(type, mode === 'carry-over' || mode === 'replacement' ? 'key' : 'result') ]);
        const path = mode === 'rename' ? {
          from: `${prefix}:key`,
          to: `${prefix}:result`
        } : mode === 'guard' ? {
          to: `${prefix}:result`,
          set: 'static',
          when: {
            path: `${prefix}:key`,
            exists: true
          }
        } : mode === 'interpolation' ? {
          to: `${prefix}:result`,
          template: `\${${prefix}:key}`
        } : mode === 'replacement' ? {
          to: `${prefix}:key`,
          set: 'replacement'
        } : null;
        const {
          modeler,
          migrationModeler,
          element
        } = await setup(old, [ value(type, 'key', 'FIRST_VALUE'), value(type, 'key', 'SECOND_VALUE') ]);
        const before = (await modeler.saveXML({
          format: true
        })).xml;
        assert.throws(() => migrateElement({
          modeler: migrationModeler,
          element,
          fromTemplate: old,
          target,
          templates: [ old, target ],
          ...(path ? {
            recipe: parseRecipe({
              schemaVersion: 1,
              sources: [ {
                kind: 'change',
                sourceTemplateId: 'old',
                paths: [ path ]
              } ]
            })
          } : {})
        }), /Duplicate.*(?:source|backing)/i);
        assert.equal((await modeler.saveXML({
          format: true
        })).xml, before);
      });
    }
  }
});
