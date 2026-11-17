// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Applies migrations to a real headless modeler
 * (default-plugins/element-template/migration/apply.ts)
 */

import assert from 'assert';
import { migrateElement, readAppliedTemplate } from '../../../src/migration/apply.js';
import { enumerateElementValues, getExtensionElements } from '../../../src/migration/element-values.js';
import { getModdleList } from '../../../src/migration/moddle.js';
import { normalizeDestinationValue } from '../../../src/migration/plan.js';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { cleanup, createTestModeler, DIAGRAM, input, loadVendorBundle, setupAppliedModeler } from '../helper.js';
const OLD = {
  id: 'io.example.old',
  version: 1,
  name: 'Old connector',
  appliesTo: [ 'bpmn:Task' ],
  deprecated: true,
  groups: [ {
    id: 'model',
    label: 'Model'
  } ],
  properties: [ {
    type: 'Hidden',
    value: 'io.example.old',
    binding: {
      type: 'zeebe:taskDefinition',
      property: 'type'
    }
  }, input('provider', 'azure', {
    group: 'model',
    label: 'Provider'
  }), input('endpoint', '', {
    group: 'model',
    label: 'Endpoint'
  }), input('maxTokens', '', {
    group: 'model',
    label: 'Maximum tokens'
  }) ]
};
const NEW = {
  id: 'io.example.new',
  version: 1,
  name: 'New connector',
  appliesTo: [ 'bpmn:Task' ],
  groups: [ {
    id: 'model',
    label: 'Model'
  } ],
  metadata: {
    migratesFrom: {
      schemaVersion: 1,
      sources: [ {
        kind: 'change',
        sourceTemplateId: 'io.example.old',
        paths: [ {
          from: 'provider',
          to: 'backend.provider',
          valueMap: {
            rules: [ {
              match: 'azure',
              value: 'openai'
            } ]
          },
          note: {
            level: 'warning',
            message: 'Provider changed'
          }
        }, {
          from: 'endpoint',
          to: 'backend.endpoint'
        }, {
          to: 'backend.type',
          set: 'foundry'
        } ]
      } ]
    }
  },
  properties: [ {
    type: 'Hidden',
    value: 'io.example.new',
    binding: {
      type: 'zeebe:taskDefinition',
      property: 'type'
    }
  }, input('backend.provider', '', {
    group: 'model',
    label: 'Provider'
  }), input('backend.endpoint', '', {
    group: 'model',
    label: 'Endpoint'
  }), input('backend.type', '', {
    group: 'model',
    label: 'Backend'
  }), input('effort', 'default', {
    group: 'model',
    label: 'Effort'
  }) ]
};
let vendor;

function setup(applied, values) {
  return setupAppliedModeler(vendor, applied, values);
}

/** After every `applyTemplate`, overwrite the `target` input as a stale write would. */
function overwriteInputAfterApply(migrationModeler, target, source) {
  const {
    elementTemplates,
    modeling
  } = migrationModeler;
  const applyTemplate = elementTemplates.applyTemplate.bind(elementTemplates);
  migrationModeler.elementTemplates = {
    set: elementTemplates.set.bind(elementTemplates),
    applyTemplate(current, template) {
      const applied = applyTemplate(current, template) ?? current;
      const io = getModdleList(getExtensionElements(applied.businessObject), 'values').find(item => item.$type === 'zeebe:IoMapping');
      const param = getModdleList(io, 'inputParameters').find(item => item.target === target);
      assert.ok(param);
      modeling.updateModdleProperties(applied, param, {
        source
      });
      return applied;
    }
  };
}

describe('migrateElement', function() {
  before(function() {
    vendor = loadVendorBundle();
  });

  afterEach(cleanup);

  for (const feel of [ 'optional', 'required' ]) {
    it(`accepts populated ${feel} FEEL despite literal choices and patterns`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', '=secretVariable') ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('b', '', {
          feel,
          constraints: {
            notEmpty: true,
            pattern: {
              value: '^allowed$'
            }
          },
          choices: [ {
            name: 'Allowed',
            value: 'allowed'
          } ]
        }) ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      const {
        element: migrated,
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ {
              from: 'a',
              to: 'b'
            } ]
          } ]
        })
      });
      assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(v => v.key === 'b')?.value, '=secretVariable');
      assert.strictEqual(report.usedRecipe, true);
      assert.strictEqual(report.refusal, null);
      assert.deepStrictEqual(report.dropped, []);
      assert.deepStrictEqual(report.added, []);
      assert.deepStrictEqual(report.changed, []);
      assert.deepStrictEqual(report.moved.map(item => [ item.from.key, item.to.key ]), [ [ 'a', 'b' ] ]);
      assert.deepStrictEqual(report.skipped, {
        guard: [],
        template: [],
        noMatch: [],
        feel: [],
        unchecked: []
      });
      assert.strictEqual(report.lossless, true);
    });
  }
  for (const carry of [ false, true ]) {
    for (const reversed of [ false, true ]) {
      it(`writes only active duplicates with correct FEEL semantics (carry=${carry}, reversed=${reversed})`, async function() {
        const old = {
          ...OLD,
          properties: [ input(carry ? 'b' : 'a', 'secret') ]
        };
        const duplicates = [ input('b', '', {
          feel: 'required',
          condition: {
            property: 'mode',
            equals: 'on'
          }
        }), input('b', '', {
          condition: {
            property: 'mode',
            equals: 'off'
          },
          constraints: {
            pattern: {
              value: '^other$'
            }
          }
        }) ];
        const target = {
          ...NEW,
          metadata: undefined,
          properties: [ input('mode', 'on', {
            id: 'mode'
          }), ...(reversed ? duplicates.reverse() : duplicates) ]
        };
        const {
          migrationModeler,
          element
        } = await setup(old, {});
        const {
          element: migrated,
          report
        } = migrateElement({
          modeler: migrationModeler,
          element,
          fromTemplate: old,
          target,
          templates: [ old, target ],
          ...(carry ? {} : {
            recipe: parseRecipe({
              schemaVersion: 1,
              sources: [ {
                kind: 'change',
                sourceTemplateId: old.id,
                paths: [ {
                  from: 'a',
                  to: 'b'
                } ]
              } ]
            })
          })
        });
        assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(v => v.key === 'b')?.value, '=secret');
        if (!carry) {
          assert.strictEqual(report.moved[0]?.valueChange?.to, '=secret');
          assert.strictEqual(report.lossless, true);
        }
      });
    }
  }
  for (const property of [ {
    type: 'Number',
    value: '2'
  }, {
    type: 'Boolean',
    value: 'false'
  } ]) {
    it(`normalizes ${property.type} writes as the real Modeler does`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', property.value) ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('b', '', {
          type: property.type
        }) ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      const {
        element: migrated,
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ {
              from: 'a',
              to: 'b'
            } ]
          } ]
        })
      });
      assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(v => v.key === 'b')?.value, `=${property.value}`);
      assert.strictEqual(report.moved[0]?.valueChange?.to, `=${property.value}`);
      assert.strictEqual(report.lossless, true);
    });
  }
  for (const rule of [ {
    constraints: {
      notEmpty: true
    },
    value: '   ',
    diagnostic: /notEmpty/
  }, {
    choices: [ {
      name: 'Allowed',
      value: 'allowed'
    } ],
    value: 'SECRET',
    diagnostic: /choice/
  }, {
    constraints: {
      pattern: {
        value: '^allowed$'
      }
    },
    value: 'SECRET',
    diagnostic: /pattern/
  }, {
    constraints: {
      minLength: 1
    },
    value: 'SECRET',
    diagnostic: /unsupported constraint minLength/
  } ]) {
    it(`rejects invalid carry-over before real-modeler mutation (${rule.diagnostic})`, async function() {
      const old = {
        ...OLD,
        properties: [ input('b', rule.value) ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('b', 'allowed', rule) ]
      };
      const {
        modeler,
        migrationModeler,
        element
      } = await setup(old, {});
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      assert.throws(() => migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ]
      }), error => error instanceof Error && /carry-over.*input:b/.test(error.message) && rule.diagnostic.test(error.message) && !error.message.includes('SECRET'));
      assert.strictEqual((await modeler.saveXML({
        format: true
      })).xml, before);
    });
  }
  for (const crossType of [ false, true ]) {
    for (const swap of [ false, true ]) {
      it(`reconciles simultaneous ${swap ? 'swap' : 'chain'} writes (cross-type=${crossType})`, async function() {
        const b = crossType ? {
          type: 'String',
          value: 'second',
          binding: {
            type: 'zeebe:taskHeader',
            key: 'b'
          }
        } : input('b', 'second');
        const old = {
          ...OLD,
          properties: [ input('a', 'first'), b ]
        };
        const target = {
          ...NEW,
          metadata: undefined,
          properties: [ input(swap ? 'a' : 'c', ''), b ]
        };
        const {
          modeler,
          migrationModeler,
          element
        } = await setup(old, {});
        const {
          element: migrated,
          report
        } = migrateElement({
          modeler: migrationModeler,
          element,
          fromTemplate: old,
          target,
          templates: [ old, target ],
          recipe: parseRecipe({
            schemaVersion: 1,
            sources: [ {
              kind: 'change',
              sourceTemplateId: old.id,
              paths: [ {
                from: 'input:a',
                to: crossType ? 'header:b' : 'input:b'
              }, {
                from: crossType ? 'header:b' : 'input:b',
                to: swap ? 'input:a' : 'input:c'
              } ]
            } ]
          })
        });
        const values = enumerateElementValues(getExtensionElements(migrated.businessObject));
        assert.strictEqual(values.find(item => item.key === 'b')?.value, 'first');
        assert.strictEqual(values.find(item => item.key === (swap ? 'a' : 'c'))?.value, 'second');

        // Target template order: the destination of the second path comes first.
        assert.deepStrictEqual(report.moved.map(move => [ move.from.key, move.to.key ]), [ [ 'b', swap ? 'a' : 'c' ], [ 'a', 'b' ] ]);
        assert.strictEqual(report.moved[1]?.to.bindingType, b.binding.type);
        assert.deepStrictEqual(report.dropped, []);
        assert.strictEqual(report.lossless, true);
        const {
          xml
        } = await modeler.saveXML({
          format: true
        });
        assert.match(xml, new RegExp(`<zeebe:input source="second" target="${swap ? 'a' : 'c'}" />`));
        assert.strictEqual(xml.match(/second/g)?.length, 1);
        assert.strictEqual(xml.match(/first/g)?.length, 1);
      });
    }
  }
  for (const kind of [ 'set', 'template' ]) {
    it(`marks a mismatched ${kind} write lossy with no source drop`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', 'secret') ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('a', ''), input('b', '') ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      overwriteInputAfterApply(migrationModeler, 'b', 'unrelated');
      const {
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ kind === 'set' ? {
              to: 'b',
              set: 'expected'
            } : {
              to: 'b',
              template: 'prefix-${a}'
            } ]
          } ]
        })
      });
      assert.deepStrictEqual(report.dropped, []);
      assert.deepStrictEqual(report.added.map(item => item.value), [ 'unrelated' ]);
      assert.strictEqual(report.lossless, false);
    });
  }
  for (const kind of [ 'set', 'template' ]) {
    it(`marks an inactive ${kind} write lossy even when there is no source to drop`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', 'secret') ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('a', ''), input('kind', 'off', {
          id: 'kind'
        }), input('b', '', {
          condition: {
            property: 'kind',
            equals: 'on'
          }
        }) ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      const {
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ kind === 'set' ? {
              to: 'b',
              set: 'static'
            } : {
              to: 'b',
              template: 'prefix-${a}'
            } ]
          } ]
        })
      });
      assert.deepStrictEqual(report.dropped, []);
      assert.deepStrictEqual(report.added.map(item => item.key), [ 'kind' ]);
      assert.strictEqual(report.lossless, false);
    });
  }
  for (const kind of [ 'move', 'set', 'template' ]) {
    it(`reconciles FEEL-normalized ${kind} writes`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', 'secret') ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('b', '', {
          feel: 'required'
        }) ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      const {
        element: migrated,
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ kind === 'move' ? {
              from: 'a',
              to: 'b'
            } : kind === 'set' ? {
              to: 'b',
              set: 'secret'
            } : {
              to: 'b',
              template: '${a}'
            } ]
          } ]
        })
      });
      assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(item => item.key === 'b')?.value, '=secret');
      if (kind === 'move') {
        assert.strictEqual(report.moved[0]?.valueChange?.to, '=secret');
        assert.strictEqual(report.lossless, true);
      } else assert.strictEqual(report.added[0]?.value, '=secret');
    });
  }
  for (const kind of [ 'move', 'translated', 'set', 'template' ]) {
    for (const finalState of [ 'removed', 'overwritten', 'forwarded', 'reappeared' ]) {
      it(`reconciles ${kind} writes that are ${finalState} across steps`, async function() {
        const old = {
          ...OLD,
          properties: [ input('a', 'secret') ]
        };
        const intermediate = {
          ...old,
          version: 2,
          properties: [ input('b', '') ]
        };
        const target = {
          ...old,
          version: 3,
          properties: [ input('c', ''), ...(finalState === 'overwritten' ? [ input('b', '') ] : []) ]
        };
        const expected = kind === 'move' ? 'secret' : kind === 'translated' ? 'translated' : kind === 'set' ? 'static' : 'prefix-secret';
        const final = finalState === 'reappeared' ? {
          ...old,
          version: 4,
          properties: [ input('b', expected) ]
        } : target;
        const {
          modeler,
          migrationModeler,
          element
        } = await setup(old, {});
        const {
          element: migrated,
          report
        } = migrateElement({
          modeler: migrationModeler,
          element,
          fromTemplate: old,
          target: final,
          templates: [ old, intermediate, target, final ],
          recipe: parseRecipe({
            schemaVersion: 1,
            sources: [ {
              kind: 'upgrade',
              sourceTemplateId: old.id,
              toVersion: 2,
              paths: [ kind === 'move' || kind === 'translated' ? {
                from: 'a',
                to: 'b',
                ...(kind === 'translated' ? {
                  valueMap: {
                    rules: [ {
                      match: 'secret',
                      value: 'translated'
                    } ]
                  }
                } : {})
              } : kind === 'set' ? {
                to: 'b',
                set: 'static'
              } : {
                to: 'b',
                template: 'prefix-${a}'
              } ]
            }, {
              kind: 'upgrade',
              sourceTemplateId: old.id,
              toVersion: 3,
              paths: finalState === 'forwarded' ? [ {
                from: 'b',
                to: 'c'
              } ] : finalState === 'overwritten' ? [ {
                to: 'b',
                set: 'replacement'
              } ] : []
            }, ...(finalState === 'reappeared' ? [ {
              kind: 'upgrade',
              sourceTemplateId: old.id,
              toVersion: 4,
              paths: []
            } ] : []) ]
          })
        });
        const values = enumerateElementValues(getExtensionElements(migrated.businessObject));
        if (finalState === 'forwarded') {
          assert.strictEqual(values.find(item => item.key === 'c')?.value, expected);
          assert.deepStrictEqual(report.moved.map(item => [ item.from.key, item.to.key ]), kind === 'move' || kind === 'translated' ? [ [ 'a', 'c' ] ] : []);
          assert.deepStrictEqual(report.added.map(item => [ item.key, item.value ]), kind === 'move' || kind === 'translated' ? [] : [ [ 'c', expected ] ]);
        } else {
          assert.deepStrictEqual(report.moved, []);
          assert.deepStrictEqual(report.added.map(item => [ item.key, item.value ]), finalState === 'overwritten' ? [ [ 'b', 'replacement' ] ] : finalState === 'reappeared' ? [ [ 'b', expected ] ] : []);
          assert.deepStrictEqual(report.dropped, [ {
            key: 'a',
            bindingType: 'zeebe:input',
            value: 'secret'
          } ]);
          assert.strictEqual(report.lossless, false);
        }
        const {
          xml
        } = await modeler.saveXML({
          format: true
        });
        if (finalState === 'removed') assert.doesNotMatch(xml, /target="b"/);
      });
    }
  }
  for (const transformed of [ false, true ]) {
    it(`rejects final value mismatches for ${transformed ? 'translated' : 'plain'} moves`, async function() {
      const old = {
        ...OLD,
        properties: [ input('a', 'secret') ]
      };
      const target = {
        ...NEW,
        metadata: undefined,
        properties: [ input('b', '') ]
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {});
      overwriteInputAfterApply(migrationModeler, 'b', 'unrelated');
      const {
        report
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'change',
            sourceTemplateId: old.id,
            paths: [ {
              from: 'a',
              to: 'b',
              ...(transformed ? {
                valueMap: {
                  rules: [ {
                    match: 'secret',
                    value: 'translated'
                  } ]
                }
              } : {})
            } ]
          } ]
        })
      });
      assert.deepStrictEqual(report.moved, []);
      assert.deepStrictEqual(report.dropped.map(item => item.value), [ 'secret' ]);
      assert.deepStrictEqual(report.added.map(item => item.value), [ 'unrelated' ]);
      assert.strictEqual(report.lossless, false);
    });
  }

  it('preserves a move when a discriminator write activates its conditional destination', async function() {
    const old = {
      ...OLD,
      properties: [ input('a', 'secret') ]
    };
    const target = {
      ...NEW,
      metadata: undefined,
      properties: [ input('kind', 'off', {
        id: 'kind'
      }), input('b', '', {
        condition: {
          property: 'kind',
          equals: 'on'
        }
      }) ]
    };
    const {
      migrationModeler,
      element
    } = await setup(old, {});
    const {
      element: migrated,
      report
    } = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: old,
      target,
      templates: [ old, target ],
      recipe: parseRecipe({
        schemaVersion: 1,
        sources: [ {
          kind: 'change',
          sourceTemplateId: old.id,
          paths: [ {
            from: 'a',
            to: 'b'
          }, {
            to: 'kind',
            set: 'on'
          } ]
        } ]
      })
    });
    assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(item => item.key === 'b')?.value, 'secret');
    assert.deepStrictEqual(report.moved.map(item => [ item.from.key, item.to.key ]), [ [ 'a', 'b' ] ]);
    assert.strictEqual(report.lossless, true);
  });

  it('rejects inconsistent applied-template context before mutation', async function() {
    const {
      migrationModeler,
      element
    } = await setup(OLD, {});
    assert.throws(() => migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: {
        ...OLD,
        version: 99
      },
      target: NEW,
      templates: [ OLD, NEW ]
    }), /applied template/);
  });

  it('reports loss when a conditional destination never materializes', async function() {
    const target = {
      ...NEW,
      properties: [ input('kind', 'off', {
        id: 'kind'
      }), input('b', '', {
        condition: {
          property: 'kind',
          equals: 'on'
        }
      }) ],
      metadata: undefined
    };
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(OLD, {
      provider: 'secret'
    });
    const {
      report
    } = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: OLD,
      target,
      templates: [ OLD, target ],
      recipe: parseRecipe({
        schemaVersion: 1,
        sources: [ {
          kind: 'change',
          sourceTemplateId: OLD.id,
          paths: [ {
            from: 'provider',
            to: 'b'
          } ]
        } ]
      })
    });
    assert.deepStrictEqual(report.moved, []);
    assert.deepStrictEqual(report.dropped, [ {
      key: 'provider',
      bindingType: 'zeebe:input',
      label: 'Provider',
      group: 'model',
      groupLabel: 'Model',
      value: 'secret'
    } ]);
    assert.strictEqual(report.lossless, false);
    assert.doesNotMatch((await modeler.saveXML({
      format: true
    })).xml, /target="b"/);
  });

  it('moves, translates and sets values per the embedded recipe', async function() {
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(OLD, {
      provider: 'azure',
      endpoint: 'https://x',
      maxTokens: '2000'
    });
    const {
      report
    } = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: OLD,
      target: NEW,
      templates: [ OLD, NEW ]
    });
    const {
      xml
    } = await modeler.saveXML({
      format: true
    });
    assert.match(xml, /modelerTemplate="io.example.new"/);
    assert.match(xml, /<zeebe:input source="openai" target="backend.provider"/);
    assert.match(xml, /<zeebe:input source="https:\/\/x" target="backend.endpoint"/);
    assert.match(xml, /<zeebe:input source="foundry" target="backend.type"/);
    assert.match(xml, /<zeebe:input source="default" target="effort"/);
    assert.doesNotMatch(xml, /target="provider"/);
    assert.strictEqual(report.usedRecipe, true);
    assert.deepStrictEqual(report.moved.map(m => [ m.from.key, m.to.key ]), [ [ 'provider', 'backend.provider' ], [ 'endpoint', 'backend.endpoint' ] ]);
    assert.deepStrictEqual(report.dropped.map(d => [ d.label, d.value ]), [ [ 'Maximum tokens', '2000' ] ]);
    assert.deepStrictEqual(report.added.map(a => a.key).sort(), [ 'backend.type', 'effort' ]);
    assert.deepStrictEqual(report.notes, [ {
      level: 'warning',
      message: 'Provider changed'
    } ]);
  });

  it('falls back to carry-over and reports drops without a recipe', async function() {
    const bare = {
      ...NEW,
      metadata: undefined
    };
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(OLD, {
      provider: 'azure',
      maxTokens: '2000'
    });
    const {
      report
    } = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: OLD,
      target: bare,
      templates: [ OLD, bare ]
    });
    const {
      xml
    } = await modeler.saveXML({
      format: true
    });
    assert.match(xml, /modelerTemplate="io.example.new"/);
    assert.strictEqual(report.usedRecipe, false);
    assert.deepStrictEqual(report.dropped.map(d => d.key).sort(), [ 'maxTokens', 'provider' ]);
  });

  it('uses a supplied recipe over the embedded one', async function() {
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(OLD, {
      provider: 'azure',
      endpoint: 'https://x'
    });
    migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: OLD,
      target: NEW,
      templates: [ OLD, NEW ],
      recipe: parseRecipe({
        schemaVersion: 1,
        sources: [ {
          kind: 'change',
          sourceTemplateId: 'io.example.old',
          paths: [ {
            from: 'endpoint',
            to: 'backend.provider'
          } ]
        } ]
      })
    });
    const {
      xml
    } = await modeler.saveXML({
      format: true
    });
    assert.match(xml, /<zeebe:input source="https:\/\/x" target="backend.provider"/);
  });

  it('fails before touching the diagram when a recipe targets an unbound path', async function() {
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(OLD, {
      provider: 'azure'
    });
    assert.throws(() => migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: OLD,
      target: NEW,
      templates: [ OLD, NEW ],
      recipe: parseRecipe({
        schemaVersion: 1,
        sources: [ {
          kind: 'change',
          sourceTemplateId: 'io.example.old',
          paths: [ {
            from: 'provider',
            to: 'nowhere'
          } ]
        } ]
      })
    }), /not a binding in template io.example.new@1/);
    const {
      xml
    } = await modeler.saveXML({
      format: true
    });
    assert.match(xml, /modelerTemplate="io.example.old"/);
  });

  it('skips every step when the element already sits on the target, so --map moves are neither reported nor written', async function() {

    // The final step is skipped and nothing is written, so buildReport finds
    // no change and reports no moves. The CLI warns on stderr instead.
    const target = {
      ...NEW,
      metadata: undefined,
      properties: [ input('a', 'keep'), input('b', '') ]
    };
    const {
      modeler,
      migrationModeler,
      element
    } = await setup(target, {
      a: 'keep'
    });
    const before = (await modeler.saveXML({
      format: true
    })).xml;
    const {
      element: migrated,
      report
    } = migrateElement({
      modeler: migrationModeler,
      element,
      fromTemplate: target,
      target,
      templates: [ target ],
      maps: [ {
        from: {
          key: 'a',
          bindingType: null
        },
        to: {
          key: 'b',
          bindingType: null
        }
      } ]
    });
    assert.deepStrictEqual(report.moved, []);
    assert.deepStrictEqual(report.dropped, []);
    assert.strictEqual(enumerateElementValues(getExtensionElements(migrated.businessObject)).find(v => v.key === 'b')?.value, '');
    assert.strictEqual((await modeler.saveXML({
      format: true
    })).xml, before);
  });

  it('stores Boolean and Number defaults exactly as normalizeDestinationValue predicts', async function() {
    const literals = [ 'false', 'FALSE', '', '0', 'no', ' false', '=x', 'abc', '1e3', '-1' ];
    const properties = [ 'Boolean', 'Number' ].flatMap(type => [ 'static', 'optional' ].flatMap(feel => literals.map((value, index) => input(`${type}.${feel}.${index}`, value, {
      type,
      feel
    }))));
    const template = {
      ...OLD,
      properties: [ ...OLD.properties, ...properties ]
    };
    const {
      element
    } = await setup(template, {});
    const stored = enumerateElementValues(getExtensionElements(element.businessObject));
    for (const property of properties) {
      assert.strictEqual(stored.find(v => v.key === property.binding.name)?.value, normalizeDestinationValue(property, property.value), property.binding.name);
    }
  });
});

describe('migrateElement boundary cases', function() {
  before(function() {
    vendor = loadVendorBundle();
  });

  afterEach(cleanup);
  const rename = parseRecipe({
    schemaVersion: 1,
    sources: [ {
      kind: 'change',
      sourceTemplateId: OLD.id,
      paths: [ {
        from: 'endpoint',
        to: 'backend.endpoint'
      } ]
    } ]
  });
  for (const [ name, value ] of [ [ 'ampersand, angle brackets and quotes', 'a&b <c> "d" \'e\' &amp;' ], [ 'unicode and an emoji', 'h\u00e9llo \u4e16\u754c \u{1F680}' ], [ 'newlines and tabs', 'line1\nline2\r\n\tindented' ], [ 'leading and trailing spaces', '  padded  ' ], [ 'a very long value', 'x'.repeat(20_000) ] ]) {
    it(`a value with ${name} survives the migration and an XML round trip`, async function() {
      const {
        modeler,
        migrationModeler,
        element
      } = await setup(OLD, {
        endpoint: value
      });
      migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: OLD,
        target: NEW,
        templates: [ OLD, NEW ],
        recipe: rename
      });
      const {
        xml
      } = await modeler.saveXML({
        format: true
      });
      const reloaded = await createTestModeler(vendor, xml);
      const reloadedElement = reloaded.get('elementRegistry').get('Task_1');
      assert.ok(reloadedElement);
      const stored = enumerateElementValues(getExtensionElements(reloadedElement.businessObject)).find(v => v.key === 'backend.endpoint');
      assert.strictEqual(stored?.value, value);
    });
  }

  // readAppliedTemplate takes a version string through the same Integer
  // parsing as a real element, so a plain object and a loaded diagram agree.
  for (const version of [ '1', '0x1', ' 1 ', '01', '1e0', '+1', '1.5', '-1', '', 'abc', '9007199254740993' ]) {
    it(`an applied version of ${JSON.stringify(version)} reads like the Modeler reads it`, async function() {
      const xml = DIAGRAM.replace('<bpmn:serviceTask id="Task_1" />', `<bpmn:serviceTask id="Task_1" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" zeebe:modelerTemplate="x" zeebe:modelerTemplateVersion="${version}" />`);
      const modeler = await createTestModeler(vendor, xml);
      const real = modeler.get('elementRegistry').get('Task_1');
      assert.ok(real);
      const plain = {
        $type: 'bpmn:ServiceTask',
        get: name => ({
          modelerTemplate: 'x',
          modelerTemplateVersion: version
        })[name]
      };
      assert.deepStrictEqual(readAppliedTemplate(plain), readAppliedTemplate(real.businessObject));
    });
  }

  it('a versionless applied template reads as version 0', function() {
    assert.deepStrictEqual(readAppliedTemplate({
      $type: 'bpmn:ServiceTask',
      get: name => ({
        modelerTemplate: 'x'
      })[name]
    }), {
      id: 'x',
      version: 0
    });
  });
  for (const [ label, from, to ] of [ [ 'from', {
    version: undefined
  }, {} ], [ 'to', {}, {
    version: undefined
  } ] ]) {
    it(`migrates ${label} a versionless template`, async function() {
      const old = {
        ...OLD,
        ...from
      };
      const target = {
        ...NEW,
        ...to
      };
      const {
        migrationModeler,
        element
      } = await setup(old, {
        provider: 'azure'
      });
      const {
        element: migrated
      } = migrateElement({
        modeler: migrationModeler,
        element,
        fromTemplate: old,
        target,
        templates: [ old, target ]
      });
      assert.deepStrictEqual(readAppliedTemplate(migrated.businessObject), {
        id: NEW.id,
        version: target.version ?? 0
      });
    });
  }
});

describe('migrateElement with an editable job type', function() {
  before(function() {
    vendor = loadVendorBundle();
  });

  afterEach(cleanup);
  const worker = (id, jobType) => ({
    id,
    version: 1,
    name: id,
    appliesTo: [ 'bpmn:Task' ],
    properties: [ {
      type: 'String',
      value: jobType,
      binding: {
        type: 'zeebe:taskDefinition',
        property: 'type'
      }
    }, input('a') ]
  });
  const OLD_WORKER = worker('io.example.worker.v1', 'io.example:worker:1');
  const NEW_WORKER = worker('io.example.worker.v2', 'io.example:worker:2');

  // Template application, not a recipe, decides the job type.
  for (const [ label, seeded, expected ] of [ [ 'replaces the default job type', 'io.example:worker:1', 'io.example:worker:2' ], [ 'keeps a custom job type', 'my-team:worker', 'my-team:worker' ] ]) {
    it(label, async function() {
      const applied = structuredClone(OLD_WORKER);
      applied.properties[0].value = seeded;
      const modeler = await createTestModeler(vendor);
      const elementTemplates = modeler.get('elementTemplates');
      elementTemplates.set([ applied ]);
      const task = modeler.get('elementRegistry').get('Task_1');
      assert.ok(task);
      const element = elementTemplates.applyTemplate(task, applied) ?? task;
      const {
        element: migrated
      } = migrateElement({
        modeler: {
          elementTemplates,
          modeling: modeler.get('modeling')
        },
        element,
        fromTemplate: OLD_WORKER,
        target: NEW_WORKER,
        templates: [ OLD_WORKER, NEW_WORKER ]
      });
      const taskDefinition = getModdleList(getExtensionElements(migrated.businessObject), 'values').find(v => v.$type === 'zeebe:TaskDefinition');
      assert.strictEqual(taskDefinition?.get('type'), expected);
    });
  }
});
