// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for resolving a recipe source against element values
 * (default-plugins/element-template/migration/plan.ts)
 */

import assert from 'assert';
import { buildStepPlan, CARRY_OVER_LABEL, carryOverWrites, normalizeDestinationValue, validateDestinationValues, validateTargets } from '../../../src/migration/plan.js';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { elementValue } from '../helper.js';
function entriesOf(...paths) {
  const [ source ] = parseRecipe({
    schemaVersion: 1,
    sources: [ {
      kind: 'change',
      sourceTemplateId: 'old',
      paths
    } ]
  }).sources;
  return source.entries;
}

describe('buildStepPlan', function() {
  it('shares active-property identity with apply and normalizes upstream typed FEEL storage', function() {
    for (const bindingType of [ 'zeebe:input', 'zeebe:output', 'zeebe:taskHeader' ]) {
      for (const feel of [ undefined, 'static', 'optional', 'required' ]) {
        for (const type of [ 'String', 'Number', 'Boolean' ]) {
          const property = {
            type,
            feel,
            binding: {
              type: bindingType
            }
          };
          const cast = feel === 'required' || type !== 'String' && (feel !== undefined || bindingType !== 'zeebe:taskHeader');
          const value = type === 'Boolean' ? 'false' : '2';
          assert.strictEqual(normalizeDestinationValue(property, value), cast ? `=${value}` : value);
          assert.strictEqual(normalizeDestinationValue(property, '=expr'), '=expr');
        }
      }
    }
    const active = {
      type: 'String',
      binding: {
        type: 'zeebe:input',
        name: 'b'
      }
    };
    const inactive = {
      ...active,
      condition: {
        property: 'missing',
        isActive: true
      }
    };
    const target = {
      id: 'new',
      properties: [ inactive, active ]
    };
    const plan = buildStepPlan(entriesOf({
      to: 'b',
      set: 'allowed'
    }), [], target);
    assert.deepStrictEqual(validateDestinationValues(plan.writes, [], target), new Set([ active ]));
  });

  it('matches condition values with upstream Number, Boolean and required FEEL coercion', function() {
    for (const discriminator of [ {
      type: 'Number',
      value: 2,
      equals: '=2',
      other: '=3'
    }, {
      type: 'Boolean',
      value: true,
      equals: true,
      other: false
    }, {
      type: 'Boolean',
      value: false,
      equals: false,
      other: true
    }, {
      type: 'String',
      feel: 'required',
      value: '=on',
      equals: 'on',
      other: 'off'
    } ]) {
      const {
        other,
        ...matching
      } = discriminator;
      const targetWith = equals => ({
        id: 'new',
        properties: [ {
          ...matching,
          id: 'mode',
          binding: {
            type: 'zeebe:input',
            name: 'mode'
          }
        }, {
          condition: {
            property: 'mode',
            equals
          },
          constraints: {
            notEmpty: true
          },
          binding: {
            type: 'zeebe:input',
            name: 'b'
          }
        } ]
      });
      assert.throws(() => buildStepPlan(entriesOf({
        to: 'b',
        set: ''
      }), [], targetWith(discriminator.equals)), /notEmpty/);
      assert.doesNotThrow(() => buildStepPlan(entriesOf({
        to: 'b',
        set: ''
      }), [], targetWith(other)), `${discriminator.type} ${String(discriminator.value)} vs ${String(other)}`);
    }
  });

  it('does not treat a static leading equals sign as an empty expression', function() {
    assert.doesNotThrow(() => buildStepPlan(entriesOf({
      to: 'b',
      set: '='
    }), [], {
      id: 'new',
      properties: [ {
        constraints: {
          notEmpty: true
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    }));
  });

  it('validates every simultaneously active duplicate and skips all inactive duplicates', function() {
    const target = {
      id: 'new',
      properties: [ {
        constraints: {
          notEmpty: true
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      }, {
        constraints: {
          pattern: {
            value: '^allowed$'
          }
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    assert.throws(() => buildStepPlan(entriesOf({
      to: 'b',
      set: 'other'
    }), [], target), /pattern/);
    assert.doesNotThrow(() => buildStepPlan(entriesOf({
      to: 'b',
      set: ''
    }), [], {
      ...target,
      properties: target.properties.map(p => ({
        ...p,
        condition: {
          property: 'missing',
          isActive: true
        }
      }))
    }));
  });

  it('validates only active duplicate properties using all resolved discriminator writes', function() {
    const target = {
      id: 'new',
      properties: [ {
        id: 'mode',
        value: 'off',
        binding: {
          type: 'zeebe:input',
          name: 'mode'
        }
      }, {
        condition: {
          property: 'mode',
          equals: 'on'
        },
        choices: [ {
          value: 'allowed'
        } ],
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      }, {
        condition: {
          property: 'mode',
          equals: 'off'
        },
        constraints: {
          pattern: {
            value: '^other$'
          }
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    const paths = [ {
      to: 'b',
      set: 'allowed'
    }, {
      to: 'mode',
      set: 'on'
    } ];
    for (const ordered of [ paths, [ ...paths ].reverse() ]) {
      assert.doesNotThrow(() => buildStepPlan(entriesOf(...ordered), [], target));
      assert.throws(() => buildStepPlan(entriesOf(...ordered.map(p => p.to === 'b' ? {
        ...p,
        set: 'SECRET'
      } : p)), [], target), /input:b.*choice/);
    }
  });

  it('validates populated non-Hidden carry-over values without adding recipe facts', function() {
    for (const property of [ {
      constraints: {
        notEmpty: true
      },
      value: '   '
    }, {
      choices: [ {
        value: 'allowed'
      } ],
      value: 'SECRET'
    }, {
      constraints: {
        pattern: {
          value: '^allowed$'
        }
      },
      value: 'SECRET'
    } ]) {
      const target = {
        id: 'new',
        properties: [ {
          ...property,
          type: 'String',
          binding: {
            type: 'zeebe:input',
            name: 'b'
          }
        } ]
      };
      assert.throws(() => buildStepPlan([], [ elementValue('b', property.value) ], target), error => error instanceof Error && /carry-over.*input:b.*constraint/.test(error.message) && !error.message.includes('SECRET'));
      assert.doesNotThrow(() => buildStepPlan(entriesOf({
        to: 'b',
        set: 'allowed'
      }), [ elementValue('b', property.value) ], target));
      assert.doesNotThrow(() => buildStepPlan([], [ elementValue('b', property.value) ], {
        ...target,
        properties: target.properties.map(p => ({
          ...p,
          type: 'Hidden'
        }))
      }));
    }
    const plan = buildStepPlan([], [ elementValue('b', 'allowed') ], {
      id: 'new',
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    });
    assert.deepStrictEqual(plan.writes, []);
    assert.deepStrictEqual(plan.facts.set, []);
  });

  it('uses defaults, qualified carry-over, allMatch, oneOf, isEmpty and recursive isActive conditions', function() {
    const target = {
      id: 'new',
      properties: [ {
        id: 'mode',
        value: 'on',
        binding: {
          type: 'zeebe:input',
          name: 'mode'
        }
      }, {
        id: 'gate',
        condition: {
          property: 'mode',
          oneOf: [ 'on' ]
        },
        binding: {
          type: 'zeebe:input',
          name: 'gate'
        }
      }, {
        condition: {
          allMatch: [ {
            property: 'gate',
            isActive: true
          }, {
            property: 'gate',
            isEmpty: true
          } ]
        },
        constraints: {
          notEmpty: true
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    assert.throws(() => buildStepPlan(entriesOf({
      to: 'b',
      set: ''
    }), [], target), /notEmpty/);
    assert.doesNotThrow(() => buildStepPlan(entriesOf({
      to: 'b',
      set: ''
    }), [ elementValue('mode', 'off'), {
      ...elementValue('mode', 'on'),
      bindingType: 'zeebe:taskHeader'
    } ], target));
    assert.doesNotThrow(() => buildStepPlan(entriesOf({
      to: 'b',
      set: ''
    }, {
      to: 'gate',
      set: 'populated'
    }), [], target));
  });

  it('rejects empty FEEL bodies but bypasses literal choices and patterns for expressions', function() {
    for (const feel of [ 'optional', 'required' ]) {
      const target = {
        id: 'new',
        properties: [ {
          feel,
          constraints: {
            notEmpty: true,
            pattern: {
              value: '^allowed$'
            }
          },
          choices: [ {
            value: 'allowed'
          } ],
          binding: {
            type: 'zeebe:input',
            name: 'b'
          }
        } ]
      };
      assert.doesNotThrow(() => buildStepPlan(entriesOf({
        to: 'b',
        set: '=secretVariable'
      }), [], target));
      for (const value of [ '', ' ', '=', '=   ' ]) assert.throws(() => buildStepPlan(entriesOf({
        to: 'b',
        set: value
      }), [], target), /notEmpty/);
    }
    assert.throws(() => buildStepPlan(entriesOf({
      to: 'b',
      set: '=expr'
    }), [], {
      id: 'new',
      properties: [ {
        choices: [ {
          value: 'allowed'
        } ],
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    }), /choice/);
  });

  it('identifies entries and qualified destinations while sanitizing invalid pattern diagnostics', function() {
    const entries = entriesOf({
      to: 'b',
      set: 'SECRET'
    });
    assert.throws(() => buildStepPlan(entries, [], {
      id: 'new',
      properties: [ {
        constraints: {
          pattern: {
            value: '[SECRET',
            message: 'SECRET'
          }
        },
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    }), error => error instanceof Error && error.message.includes(entries[0].label) && /input:b.*pattern/.test(error.message) && !error.message.includes('SECRET'));
  });

  it('explicitly rejects unsupported active constraints, including for FEEL and carry-over', function() {
    for (const constraints of [ {
      minLength: 1
    }, {
      maxLength: 2
    }, {
      custom: true
    } ]) {
      const target = {
        id: 'new',
        properties: [ {
          feel: 'optional',
          constraints,
          binding: {
            type: 'zeebe:input',
            name: 'b'
          }
        } ]
      };
      assert.throws(() => buildStepPlan(entriesOf({
        to: 'b',
        set: '=expr'
      }), [], target), /unsupported constraint/);
      assert.throws(() => buildStepPlan([], [ elementValue('b', 'SECRET') ], target), /unsupported constraint/);
      assert.doesNotThrow(() => buildStepPlan(entriesOf({
        to: 'b',
        set: 'SECRET'
      }), [], {
        ...target,
        properties: [ {
          ...target.properties[0],
          ...{
            condition: {
              property: 'missing',
              isActive: true
            }
          }
        } ]
      }));
    }
  });

  it('validates mapped and composed values against active constraints', function() {
    const target = {
      id: 'new',
      properties: [ {
        choices: [ {
          value: 'allowed'
        } ],
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    for (const path of [ {
      from: 'a',
      to: 'b',
      valueMap: {
        rules: [ {
          match: '*',
          value: 'SECRET'
        } ]
      }
    }, {
      to: 'b',
      template: '${a}'
    } ]) assert.throws(() => buildStepPlan(entriesOf(path), [ elementValue('a', 'SECRET') ], target), /choice/);
  });

  it('fails closed on unsupported and cyclic destination conditions', function() {
    const message = (path, kind) => new RegExp(`^sources\\[0\\]\\.paths\\[0\\]: destination "input:${path}" has ${kind} condition$`);
    const failsClosed = (properties, to, kind) => {
      const target = {
        id: 'new',
        properties
      };
      assert.throws(() => buildStepPlan(entriesOf({
        to,
        set: 'SECRET'
      }), [], target), error => error instanceof Error && !(error instanceof RangeError) && message(to, kind).test(error.message) && !error.message.includes('SECRET'));
    };
    const bound = (id, condition) => ({
      id,
      condition,
      binding: {
        type: 'zeebe:input',
        name: id
      }
    });
    failsClosed([ bound('b', {
      property: 'b',
      custom: true
    }) ], 'b', 'unsupported');
    failsClosed([ bound('b', {
      property: 'b',
      isActive: true
    }) ], 'b', 'cyclic');
    failsClosed([ bound('a', {
      property: 'b',
      isActive: true
    }), bound('b', {
      property: 'a',
      isActive: true
    }) ], 'a', 'cyclic');
  });

  it('activates a conditional property only when its condition holds', function() {
    const conditional = condition => ({
      condition
    });
    const properties = (condition, mode = 'on') => ({
      id: 'new',
      properties: [ {
        id: 'mode',
        type: 'String',
        value: mode,
        binding: {
          type: 'zeebe:input',
          name: 'mode'
        }
      }, {
        ...conditional({
          property: 'mode',
          equals: 'never'
        }),
        id: 'off',
        type: 'String',
        binding: {
          type: 'zeebe:input',
          name: 'off'
        }
      }, {
        ...conditional(condition),
        id: 'dep',
        type: 'String',
        constraints: {
          notEmpty: true
        },
        binding: {
          type: 'zeebe:input',
          name: 'dep'
        }
      } ]
    });
    const isActive = (condition, mode) => {
      const target = properties(condition, mode);
      const plan = buildStepPlan(entriesOf({
        to: 'dep',
        set: ''
      }), [], target);
      return [ ...validateDestinationValues(plan.writes, [], target) ].some(p => p.id === 'dep');
    };
    const rejects = (condition, mode) => assert.throws(() => isActive(condition, mode), /violates notEmpty constraint/);
    const cases = [ [ 'equals', {
      property: 'mode',
      equals: 'on'
    }, {
      property: 'mode',
      equals: 'other'
    } ], [ 'oneOf', {
      property: 'mode',
      oneOf: [ 'x', 'on' ]
    }, {
      property: 'mode',
      oneOf: [ 'x', 'y' ]
    } ], [ 'allMatch', {
      allMatch: [ {
        property: 'mode',
        equals: 'on'
      }, {
        property: 'mode',
        oneOf: [ 'on' ]
      } ]
    }, {
      allMatch: [ {
        property: 'mode',
        equals: 'on'
      }, {
        property: 'mode',
        equals: 'other'
      } ]
    } ], [ 'isEmpty', {
      property: 'mode',
      isEmpty: false
    }, {
      property: 'mode',
      isEmpty: true
    } ], [ 'isActive on an active property', {
      property: 'mode',
      isActive: true
    }, {
      property: 'mode',
      isActive: false
    } ], [ 'isActive on an inactive property', {
      property: 'off',
      isActive: false
    }, {
      property: 'off',
      isActive: true
    } ] ];
    for (const [ name, matching, nonMatching ] of cases) {
      rejects(matching);
      assert.strictEqual(isActive(nonMatching), false, `${name}: not active`);
    }

    // An empty mode makes the isEmpty condition hold, so the notEmpty constraint applies.
    rejects({
      property: 'mode',
      isEmpty: true
    }, '');
    assert.strictEqual(isActive({
      property: 'missing',
      equals: 'on'
    }), false, 'a condition on a missing property is not active');
  });

  it('validates required, choice and pattern destination values without echoing them', function() {
    for (const property of [ {
      constraints: {
        notEmpty: true
      },
      value: '',
      reason: 'notEmpty'
    }, {
      choices: [ {
        name: 'Allowed',
        value: 'allowed'
      } ],
      value: 'SECRET',
      reason: 'choice'
    }, {
      constraints: {
        pattern: {
          value: '^allowed$'
        }
      },
      value: 'SECRET',
      reason: 'pattern'
    } ]) {
      const {
        reason,
        ...templateProperty
      } = property;
      const target = {
        id: 'new',
        properties: [ {
          ...templateProperty,
          type: 'String',
          binding: {
            type: 'zeebe:input',
            name: 'b'
          }
        } ]
      };
      assert.throws(() => buildStepPlan(entriesOf({
        to: 'b',
        set: property.value
      }), [], target), error => error instanceof Error && error.message === `sources[0].paths[0]: destination "input:b" violates ${reason} constraint`);
    }
  });

  it('rejects ambiguous rename, guard and interpolation reads and duplicate backing values', function() {
    const values = [ elementValue('key', 'INPUT'), {
      ...elementValue('key', 'HEADER'),
      bindingType: 'zeebe:taskHeader'
    } ];
    for (const path of [ {
      from: 'key',
      to: 'b'
    }, {
      to: 'b',
      set: 'x',
      when: {
        path: 'key',
        exists: true
      }
    }, {
      to: 'b',
      template: '${key}'
    } ]) {
      assert.throws(() => buildStepPlan(entriesOf(path), values), /Ambiguous source.*input:key.*header:key/);
    }
    assert.throws(() => buildStepPlan(entriesOf({
      from: 'input:key',
      to: 'b'
    }), [ elementValue('key', 'one'), elementValue('key', 'two') ]), /Duplicate source/);
  });

  it('renames a value and reports the move', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'a',
      to: 'b'
    }), [ elementValue('a', '1') ]);
    assert.deepStrictEqual(plan.writes.map(w => [ w.key, w.value ]), [ [ 'b', '1' ] ]);
    assert.deepStrictEqual(plan.facts.moved[0].from, {
      key: 'a',
      bindingType: 'zeebe:input'
    });
    assert.strictEqual(plan.facts.moved[0].transformed, false);
  });

  it('skips a rename whose source value is absent', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'a',
      to: 'b'
    }), []);
    assert.deepStrictEqual(plan.writes, []);
    assert.deepStrictEqual(plan.facts.moved, []);
  });

  it('translates values with a value map and its default', function() {
    const entries = entriesOf({
      from: 'flag',
      to: 'format',
      valueMap: {
        rules: [ {
          match: 'true',
          value: 'DOCUMENT'
        } ],
        default: 'JSON'
      }
    });
    assert.strictEqual(buildStepPlan(entries, [ elementValue('flag', 'true') ]).writes[0].value, 'DOCUMENT');
    const other = buildStepPlan(entries, [ elementValue('flag', 'false') ]);
    assert.strictEqual(other.writes[0].value, 'JSON');
    assert.strictEqual(other.facts.moved[0].transformed, true);
  });

  it('reports a value map without a match and keeps the target default', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'a',
      to: 'b',
      valueMap: {
        rules: [ {
          match: 'x',
          value: 'y'
        } ]
      }
    }), [ elementValue('a', 'other') ]);
    assert.deepStrictEqual(plan.writes, []);
    assert.deepStrictEqual(plan.facts.noMatch, [ {
      from: 'a',
      to: 'b'
    } ]);
  });

  it('moves a FEEL expression as-is and reports the skipped value map', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'a',
      to: 'b',
      valueMap: {
        rules: [ {
          match: 'x',
          value: 'y'
        } ]
      }
    }), [ elementValue('a', '=expr') ]);
    assert.strictEqual(plan.writes[0].value, '=expr');
    assert.deepStrictEqual(plan.facts.feelSkipped, [ {
      from: 'a',
      to: 'b'
    } ]);
  });

  it('matches value map rules with a * glob', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'm',
      to: 'n',
      valueMap: {
        rules: [ {
          match: 'claude-*',
          value: 'anthropic'
        } ]
      }
    }), [ elementValue('m', 'claude-3') ]);
    assert.strictEqual(plan.writes[0].value, 'anthropic');
  });

  it('writes a static value only when its guard holds', function() {
    const entries = entriesOf({
      to: 'backend',
      set: 'foundry',
      when: {
        path: 'type',
        equals: 'azure'
      }
    });
    assert.strictEqual(buildStepPlan(entries, [ elementValue('type', 'azure') ]).writes.length, 1);
    assert.strictEqual(buildStepPlan(entries, [ elementValue('type', 'other') ]).writes.length, 0);
  });

  it('composes a template value and skips it when a reference is missing', function() {
    const entries = entriesOf({
      to: 'url',
      template: '${host}/${path}'
    });
    assert.strictEqual(buildStepPlan(entries, [ elementValue('host', 'h'), elementValue('path', 'p') ]).writes[0].value, 'h/p');
    const plan = buildStepPlan(entries, [ elementValue('host', 'h') ]);
    assert.deepStrictEqual(plan.writes, []);
    assert.deepStrictEqual(plan.facts.templateSkipped, [ {
      to: 'url',
      missing: [ 'path' ]
    } ]);
  });

  it('applies group guards to every nested entry', function() {
    const entries = entriesOf({
      when: {
        path: 'type',
        equals: 'bedrock'
      },
      rules: [ {
        from: 'region',
        to: 'aws.region'
      } ]
    });
    assert.strictEqual(buildStepPlan(entries, [ elementValue('type', 'bedrock'), elementValue('region', 'eu') ]).writes.length, 1);
    const skipped = buildStepPlan(entries, [ elementValue('type', 'azure'), elementValue('region', 'eu') ]);
    assert.strictEqual(skipped.writes.length, 0);
    assert.deepStrictEqual(skipped.facts.guardSkipped, [ {
      from: 'region',
      to: 'aws.region'
    } ]);
  });

  it('does not report a guard skip for a source another entry moved', function() {
    const entries = entriesOf({
      when: {
        path: 'type',
        equals: 'bedrock'
      },
      rules: [ {
        from: 'region',
        to: 'aws.region'
      } ]
    }, {
      when: {
        path: 'type',
        equals: 'azure'
      },
      rules: [ {
        from: 'region',
        to: 'azure.region'
      } ]
    });
    const plan = buildStepPlan(entries, [ elementValue('type', 'azure'), elementValue('region', 'eu') ]);
    assert.strictEqual(plan.writes.length, 1);
    assert.deepStrictEqual(plan.facts.guardSkipped, []);
  });

  it('evaluates in, matches, not and exists guards', function() {
    const run = (when, values) => buildStepPlan(entriesOf({
      to: 'x',
      set: '1',
      when
    }), values).writes.length;
    assert.strictEqual(run({
      path: 'p',
      in: [ 'a', 'b' ]
    }, [ elementValue('p', 'b') ]), 1);
    assert.strictEqual(run({
      path: 'p',
      in: [ 'a' ],
      not: true
    }, [ elementValue('p', 'b') ]), 1);
    assert.strictEqual(run({
      path: 'p',
      matches: 'pre*'
    }, [ elementValue('p', 'prefix') ]), 1);

    // A pattern is anchored at both ends.
    assert.strictEqual(run({
      path: 'p',
      matches: 'pre*'
    }, [ elementValue('p', 'x-prefix') ]), 0);
    assert.strictEqual(run({
      path: 'p',
      matches: '*fix'
    }, [ elementValue('p', 'prefixes') ]), 0);
    assert.strictEqual(run({
      path: 'p',
      matches: '*key*'
    }, [ elementValue('p', '={\n  key: 1\n}') ]), 1);
    assert.strictEqual(run({
      path: 'p',
      exists: false
    }, []), 1);
    assert.strictEqual(run({
      path: 'p',
      exists: true
    }, []), 0);
  });

  it('honours a binding-type prefix when reading the source', function() {
    const header = {
      bindingType: 'zeebe:taskHeader',
      key: 'k',
      value: 'h',
      isFeel: false
    };
    const plan = buildStepPlan(entriesOf({
      from: 'input:k',
      to: 'z'
    }), [ header, elementValue('k', 'i') ]);
    assert.strictEqual(plan.writes[0].value, 'i');
  });

  it('collects the notes of entries that took effect only', function() {
    const entries = entriesOf({
      from: 'a',
      to: 'b',
      note: 'moved a'
    }, {
      from: 'missing',
      to: 'c',
      note: 'never shown'
    }, {
      to: 'd',
      set: '1',
      note: {
        level: 'warning',
        message: 'set d'
      }
    });
    const plan = buildStepPlan(entries, [ elementValue('a', '1') ]);
    assert.deepStrictEqual(plan.facts.notes, [ {
      level: 'info',
      message: 'moved a'
    }, {
      level: 'warning',
      message: 'set d'
    } ]);
  });

  it('refuses two active writes to the same target', function() {
    assert.throws(() => buildStepPlan(entriesOf({
      from: 'a',
      to: 't'
    }, {
      to: 't',
      set: '1'
    }), [ elementValue('a', '1') ]), /Ambiguous migration/);
  });

  it('rejects qualified and unqualified writes to the same resolved binding', function() {
    const paths = [ {
      from: 'a',
      to: 'b'
    }, {
      to: 'input:b',
      set: 'overwrite'
    } ];
    const target = {
      id: 'new',
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    for (const ordered of [ paths, [ ...paths ].reverse() ]) {
      assert.throws(() => buildStepPlan(entriesOf(...ordered), [ elementValue('a', 'secret') ], target), /Ambiguous migration/);
    }
  });
});

describe('validateTargets', function() {
  const template = {
    id: 'new',
    version: 1,
    properties: [ {
      binding: {
        type: 'zeebe:input',
        name: 'b'
      }
    }, {
      binding: {
        type: 'zeebe:input',
        name: 'dup'
      }
    }, {
      binding: {
        type: 'zeebe:taskHeader',
        key: 'dup'
      }
    }, {
      type: 'Hidden',
      value: 'v',
      binding: {
        type: 'zeebe:input',
        name: 'fixed'
      }
    }, {
      type: 'Hidden',
      binding: {
        type: 'zeebe:input',
        name: 'unset'
      }
    } ]
  };

  it('accepts targets the template binds', function() {
    validateTargets(entriesOf({
      from: 'a',
      to: 'b'
    }), template);
  });

  it('rejects an unbound target', function() {
    assert.throws(() => validateTargets(entriesOf({
      from: 'a',
      to: 'nope'
    }), template), /not a binding in template new@1/);
  });

  it('rejects a target bound by several types unless prefixed', function() {
    assert.throws(() => validateTargets(entriesOf({
      from: 'a',
      to: 'dup'
    }), template), /several binding types/);
    validateTargets(entriesOf({
      from: 'a',
      to: 'input:dup'
    }), template);
  });

  it('rejects a target bound only by a Hidden property with a fixed value', function() {
    assert.throws(() => validateTargets(entriesOf({
      from: 'a',
      to: 'fixed'
    }), template), /"fixed" is a Hidden property with a fixed value in template new@1/);
    validateTargets(entriesOf({
      from: 'a',
      to: 'unset'
    }), template);
  });
});

describe('carryOverWrites', function() {
  const target = {
    id: 'new',
    properties: [ {
      type: 'String',
      binding: {
        type: 'zeebe:input',
        name: 'b'
      }
    }, {
      type: 'Hidden',
      binding: {
        type: 'zeebe:input',
        name: 'h'
      }
    } ]
  };

  it('returns one write per populated duplicate, checked against recipe writes only', function() {
    const writes = carryOverWrites([], [ elementValue('b', 'first'), elementValue('b', 'second'), elementValue('c', 'x') ], target);
    assert.deepStrictEqual(writes.map(w => [ w.key, w.value, w.entry.label ]), [ [ 'b', 'first', CARRY_OVER_LABEL ], [ 'b', 'second', CARRY_OVER_LABEL ] ]);
  });

  it('skips recipe-written, empty and Hidden-only targets', function() {
    const recipe = buildStepPlan(entriesOf({
      to: 'input:b',
      set: 'recipe'
    }), []).writes;
    assert.deepStrictEqual(carryOverWrites(recipe, [ elementValue('b', 'first'), elementValue('b', 'second'), elementValue('h', 'x') ], target), []);
    assert.deepStrictEqual(carryOverWrites([], [ elementValue('b', '') ], target), []);
  });
});

describe('validateDestinationValues static Number and Boolean values', function() {
  function templateOf(...properties) {
    return {
      id: 'new',
      properties: properties.map(p => ({
        binding: {
          type: 'zeebe:input',
          name: 'b'
        },
        ...p
      }))
    };
  }
  const numberPattern = {
    type: 'Number',
    feel: 'static',
    constraints: {
      notEmpty: true,
      pattern: {
        value: '^\\d+$'
      }
    }
  };

  it('validates the literal of a carried-over FEEL-stored value', function() {
    const target = templateOf(numberPattern);
    const sources = [ elementValue('b', '=20') ];
    assert.doesNotThrow(() => validateDestinationValues([], sources, target));
    assert.deepStrictEqual(carryOverWrites([], sources, target).map(w => w.value), [ '=20' ]);
  });

  it('treats a missing feel on an input binding as static', function() {
    const target = templateOf({
      ...numberPattern,
      feel: undefined
    });
    assert.doesNotThrow(() => validateDestinationValues([], [ elementValue('b', '=20') ], target));
  });

  it('still rejects a literal that violates the pattern', function() {
    assert.throws(() => validateDestinationValues([], [ elementValue('b', '=abc') ], templateOf(numberPattern)), /violates pattern constraint/);
  });

  it('validates string-valued pattern constraints', function() {
    const target = templateOf({
      type: 'String',
      constraints: {
        pattern: '^allowed$'
      }
    });
    assert.doesNotThrow(() => validateDestinationValues([], [ elementValue('b', 'allowed') ], target));
    assert.throws(() => validateDestinationValues([], [ elementValue('b', 'INVALID') ], target), /violates pattern constraint/);
  });

  it('keeps skipping the pattern for optional FEEL expressions', function() {
    assert.doesNotThrow(() => validateDestinationValues([], [ elementValue('b', '=someVar') ], templateOf({
      ...numberPattern,
      feel: 'optional'
    })));
  });

  it('treats a bare = as empty', function() {
    assert.throws(() => validateDestinationValues([], [ elementValue('b', '=') ], templateOf({
      type: 'Number',
      feel: 'static',
      constraints: {
        notEmpty: true
      }
    })), /notEmpty/);
  });

  it('checks choices against the Boolean literal', function() {
    const target = templateOf({
      type: 'Boolean',
      feel: 'static',
      choices: [ {
        value: 'true'
      } ]
    });
    assert.doesNotThrow(() => validateDestinationValues([], [ elementValue('b', '=true') ], target));
    assert.throws(() => validateDestinationValues([], [ elementValue('b', '=false') ], target), /choice/);
  });

  it('checks choices and patterns against the stored Boolean literal', function() {

    // The Modeler stores normalizeDestinationValue(...), "=true" for "yes".
    const boolean = {
      type: 'Boolean',
      feel: 'static',
      binding: {
        type: 'zeebe:input',
        name: 'b'
      }
    };
    assert.strictEqual(normalizeDestinationValue(boolean, 'yes'), '=true');
    const validate = constraint => {
      const target = templateOf({
        ...boolean,
        ...constraint
      });
      const plan = buildStepPlan(entriesOf({
        to: 'b',
        set: 'yes'
      }), [], target);
      return validateDestinationValues(plan.writes, [], target);
    };
    assert.doesNotThrow(() => validate({
      choices: [ {
        value: 'true'
      } ]
    }));
    assert.throws(() => validate({
      choices: [ {
        value: 'yes'
      } ]
    }), /violates choice constraint/);
    assert.doesNotThrow(() => validate({
      constraints: {
        pattern: {
          value: '^true$'
        }
      }
    }));
    assert.throws(() => validate({
      constraints: {
        pattern: {
          value: '^yes$'
        }
      }
    }), /violates pattern constraint/);
  });

  it('matches conditions on the stored literal', function() {
    const dependent = {
      id: 'dep',
      binding: {
        type: 'zeebe:input',
        name: 'd'
      },
      condition: {
        property: 'n',
        oneOf: [ 20, 30 ]
      },
      constraints: {
        notEmpty: true
      }
    };
    const target = templateOf({
      id: 'n',
      type: 'Number',
      feel: 'static'
    }, dependent);
    assert.throws(() => validateDestinationValues([], [ elementValue('b', '=20'), elementValue('d', ' ') ], target), /notEmpty/);
  });
});

describe('normalizeDestinationValue', function() {

  // Expected values follow the vendored bpmn-js-element-templates
  // dist/core.esm.js:44 (toFeelExpression): a Boolean becomes "=false" for
  // "false" and "" and "=true" for everything else; other types get an "=".
  const inputs = [ 'false', 'FALSE', '', '0', 'no', ' false', '=x', 'abc', '1e3', '-1' ];
  const castBoolean = [ '=false', '=true', '=false', '=true', '=true', '=true', '=x', '=true', '=true', '=true' ];
  const castText = [ '=false', '=FALSE', '=', '=0', '=no', '= false', '=x', '=abc', '=1e3', '=-1' ];
  const plain = inputs;

  // [binding, feel, Boolean, Number, String]
  const rows = [ [ 'zeebe:input', undefined, castBoolean, castText, plain ], [ 'zeebe:input', 'static', castBoolean, castText, plain ], [ 'zeebe:input', 'optional', castBoolean, castText, plain ], [ 'zeebe:input', 'required', castBoolean, castText, castText ], [ 'zeebe:property', undefined, plain, plain, plain ], [ 'zeebe:property', 'static', castBoolean, castText, plain ], [ 'zeebe:property', 'optional', castBoolean, castText, plain ], [ 'zeebe:property', 'required', castBoolean, castText, castText ] ];
  for (const [ binding, feel, boolean, number, string ] of rows) {
    it(`converts literals for ${binding} with feel ${feel}`, function() {
      for (const [ type, expected ] of [ [ 'Boolean', boolean ], [ 'Number', number ], [ 'String', string ] ]) {
        const property = {
          type,
          feel,
          binding: {
            type: binding
          }
        };
        assert.deepStrictEqual(inputs.map(value => normalizeDestinationValue(property, value)), expected, `${type}`);
      }
    });
  }
});

describe('buildStepPlan boundary cases', function() {
  const mapped = (rules, values, extra = {}) => buildStepPlan(entriesOf({
    from: 'a',
    to: 'b',
    valueMap: {
      rules,
      ...extra
    }
  }), values);

  it('overlapping value-map rules: the first matching rule wins', function() {
    const plan = mapped([ {
      match: 'x*',
      value: 'first'
    }, {
      match: 'xy',
      value: 'second'
    } ], [ elementValue('a', 'xy') ]);
    assert.deepStrictEqual(plan.writes.map(w => w.value), [ 'first' ]);
  });
  for (const [ pattern, value, hit ] of [ [ 'a.b', 'a.b', true ], [ 'a.b', 'axb', false ], [ 'a+b', 'a+b', true ], [ 'a?', 'a', false ], [ '(x)', '(x)', true ], [ '[x]', '[x]', true ], [ '^x$', '^x$', true ], [ '*', '', true ], [ 'x*', 'x', true ] ]) {
    it(`value-map glob ${JSON.stringify(pattern)} ${hit ? 'matches' : 'does not match'} ${JSON.stringify(value)}`, function() {
      const plan = mapped([ {
        match: pattern,
        value: 'hit'
      } ], [ elementValue('a', value) ], {
        default: 'miss'
      });
      assert.deepStrictEqual(plan.writes.map(w => w.value), [ hit ? 'hit' : 'miss' ], `${pattern} against ${value}`);
    });
  }

  it('the isFeel flag, not the = prefix, decides whether a value map applies', function() {
    const rules = [ {
      match: 'x',
      value: 'mapped'
    } ];
    const flagged = mapped(rules, [ {
      ...elementValue('a', 'x'),
      isFeel: true
    } ]);
    assert.deepStrictEqual(flagged.writes.map(w => w.value), [ 'x' ]);
    assert.deepStrictEqual(flagged.facts.feelSkipped, [ {
      from: 'a',
      to: 'b'
    } ]);
    const prefixed = mapped([ {
      match: '=x',
      value: 'mapped'
    } ], [ {
      ...elementValue('a', '=x'),
      isFeel: false
    } ]);
    assert.deepStrictEqual(prefixed.writes.map(w => w.value), [ 'mapped' ]);
    assert.deepStrictEqual(prefixed.facts.feelSkipped, []);
  });

  it('an empty referenced value skips a template entry and names the missing path', function() {
    const plan = buildStepPlan(entriesOf({
      to: 'b',
      template: 'pre-${a}'
    }), [ elementValue('a', '') ]);
    assert.deepStrictEqual(plan.writes, []);
    assert.deepStrictEqual(plan.facts.templateSkipped, [ {
      to: 'b',
      missing: [ 'a' ]
    } ]);
  });
  for (const [ name, source, template, expected ] of [ [ '$& and $1 are literal', '$&x$1', 'pre-${a}-post', 'pre-$&x$1-post' ], [ 'XML characters are not escaped', 'a&b"c', '<${a}>', '<a&b"c>' ], [ 'an unclosed ${ is plain text', '1', 'x ${a', 'x ${a' ] ]) {
    it(`interpolation: ${name}`, function() {
      const plan = buildStepPlan(entriesOf({
        to: 'b',
        template
      }), [ elementValue('a', source) ]);
      assert.deepStrictEqual(plan.writes.map(w => w.value), [ expected ]);
    });
  }

  it('an empty in-list never matches', function() {
    const plan = buildStepPlan(entriesOf({
      from: 'a',
      to: 'b',
      when: {
        path: 'mode',
        in: []
      }
    }), [ elementValue('a', 'x'), elementValue('mode', 'on') ]);
    assert.deepStrictEqual(plan.writes, []);
  });

  it('mutually exclusive guarded writes to one target are not ambiguous', function() {
    const entries = mode => buildStepPlan(entriesOf({
      from: 'a',
      to: 'b',
      when: {
        path: 'mode',
        equals: 'on'
      }
    }, {
      to: 'b',
      set: 'other',
      when: {
        path: 'mode',
        equals: 'on',
        not: true
      }
    }), [ elementValue('a', 'x'), elementValue('mode', mode) ]).writes.map(w => w.value);
    assert.deepStrictEqual(entries('on'), [ 'x' ]);
    assert.deepStrictEqual(entries('off'), [ 'other' ]);
  });
});
