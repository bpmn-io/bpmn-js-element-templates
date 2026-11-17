// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for resolving migration steps and successors
 * (default-plugins/element-template/migration/steps.ts)
 */

import assert from 'assert';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { findSuccessors, latestOf, resolveApplications, resolveCatalog, resolveSteps } from '../../../src/migration/steps.js';
function prop(name) {
  return {
    binding: {
      type: 'zeebe:input',
      name
    }
  };
}
function template(id, version, names, extra = {}) {
  return {
    id,
    version,
    properties: names.map(prop),
    ...extra
  };
}
function withRecipe(t, ...sources) {
  return {
    ...t,
    metadata: {
      migratesFrom: {
        schemaVersion: 1,
        sources
      }
    }
  };
}
function recipeOf(...sources) {
  return parseRecipe({
    schemaVersion: 1,
    sources
  });
}

describe('resolveSteps (same id)', function() {
  const v1 = template('t', 1, [ 'a' ]);
  const v2 = template('t', 2, [ 'b' ]);
  const v3 = withRecipe(template('t', 3, [ 'c' ]), {
    kind: 'upgrade',
    sourceTemplateId: 't',
    toVersion: 2,
    paths: [ {
      from: 'a',
      to: 'b'
    } ]
  }, {
    kind: 'upgrade',
    sourceTemplateId: 't',
    toVersion: 3,
    paths: [ {
      from: 'b',
      to: 'c'
    } ]
  });
  const catalog = [ v1, v2, v3 ];

  it('climbs every version step above the applied version', function() {
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target: v3,
      templates: catalog
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps.map(s => [ s.kind, s.version ]), [ [ 'version', 2 ], [ 'version', 3 ] ]);
  });

  it('skips steps at or below the applied version', function() {
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 2,
      target: v3,
      templates: catalog
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps.map(s => s.version), [ 3 ]);
  });

  it('returns no steps without a recipe', function() {
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target: v2,
      templates: catalog
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps, []);
  });

  it('prefers a supplied recipe over the embedded one', function() {
    const {
      steps
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target: v3,
      templates: catalog,
      recipe: recipeOf({
        kind: 'upgrade',
        sourceTemplateId: 't',
        toVersion: 2,
        paths: [ {
          from: 'a',
          to: 'b'
        } ]
      })
    });
    assert.deepStrictEqual(steps.map(s => s.version), [ 2 ]);
  });

  it('refuses a recipe reading a path nothing produces', function() {
    const broken = withRecipe(template('t', 3, [ 'c' ]), {
      kind: 'upgrade',
      sourceTemplateId: 't',
      toVersion: 3,
      paths: [ {
        from: 'missing',
        to: 'c'
      } ]
    });
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target: broken,
      templates: [ v1, v2, broken ]
    });
    assert.deepStrictEqual(steps, []);
    assert.match(refusal ?? '', /reads "missing"/);
  });

  it('an unknown applied shape skips the reads of the first step', function() {
    const stub = template('t', 1, []);
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      appliedShapeKnown: false,
      target: v3,
      templates: [ stub, v2, v3 ]
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps.map(s => s.version), [ 2, 3 ]);
  });

  it('an unknown applied shape still checks the reads of later steps', function() {
    const broken = withRecipe(template('t', 3, [ 'c' ]), {
      kind: 'upgrade',
      sourceTemplateId: 't',
      toVersion: 2,
      paths: [ {
        from: 'a',
        to: 'b'
      } ]
    }, {
      kind: 'upgrade',
      sourceTemplateId: 't',
      toVersion: 3,
      paths: [ {
        from: 'missing',
        to: 'c'
      } ]
    });
    const {
      refusal
    } = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      appliedShapeKnown: false,
      target: broken,
      templates: [ v2, broken ]
    });
    assert.match(refusal ?? '', /reads "missing"/);
  });
});

describe('resolveSteps (cross id)', function() {
  const oldV1 = template('old', 1, [ 'a' ]);
  const oldV2 = withRecipe(template('old', 2, [ 'b' ]), {
    kind: 'upgrade',
    sourceTemplateId: 'old',
    toVersion: 2,
    paths: [ {
      from: 'a',
      to: 'b'
    } ]
  });
  const fresh = withRecipe(template('new', 1, [ 'c' ]), {
    kind: 'change',
    sourceTemplateId: 'old',
    minSourceVersion: 2,
    paths: [ {
      from: 'b',
      to: 'c'
    } ]
  });
  const catalog = [ oldV1, oldV2, fresh ];

  it('climbs the source lineage, then hops', function() {
    const {
      steps
    } = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target: fresh,
      templates: catalog
    });
    assert.deepStrictEqual(steps.map(s => [ s.kind, s.templateId, s.version ]), [ [ 'version', 'old', 2 ], [ 'hop', 'new', 1 ] ]);
  });

  it('hops directly from the newest source version', function() {
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 'old',
      appliedVersion: 2,
      target: fresh,
      templates: catalog
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps.map(s => s.kind), [ 'hop' ]);
  });

  it('an unknown applied shape skips the reads of a direct hop', function() {
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 'old',
      appliedVersion: 2,
      appliedShapeKnown: false,
      target: fresh,
      templates: [ template('old', 2, []), fresh ]
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps.map(s => s.kind), [ 'hop' ]);
  });

  it('does not hop without a declared recipe for the source', function() {
    const bare = template('new', 1, [ 'c' ]);
    const {
      steps,
      refusal
    } = resolveSteps({
      appliedId: 'old',
      appliedVersion: 2,
      target: bare,
      templates: [ ...catalog.slice(0, 2), bare ]
    });
    assert.strictEqual(refusal, null);
    assert.deepStrictEqual(steps, []);
  });
});

describe('findSuccessors', function() {
  const fresh = withRecipe(template('new', 1, []), {
    kind: 'change',
    sourceTemplateId: 'old',
    paths: []
  });

  it('returns templates whose recipe hops from the applied one', function() {
    const unrelated = template('other', 1, []);
    const result = findSuccessors([ fresh, unrelated ], 'old', 3, []);
    assert.deepStrictEqual(result.map(t => t.id), [ 'new' ]);
  });

  it('skips deprecated templates and ones with an unusable recipe', function() {
    const deprecated = {
      ...fresh,
      id: 'gone',
      deprecated: true
    };
    const broken = {
      ...template('broken', 1, []),
      metadata: {
        migratesFrom: {
          schemaVersion: 9,
          sources: []
        }
      }
    };
    assert.deepStrictEqual(findSuccessors([ deprecated, broken ], 'old', 3, []), []);
  });

  it('a change floor needs a loaded source version at or above it', function() {
    const gated = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 13,
      paths: []
    });
    assert.deepStrictEqual(findSuccessors([ gated ], 'old', 5, []), []);
    const latestOld = template('old', 13, []);
    assert.deepStrictEqual(findSuccessors([ gated ], 'old', 5, [ latestOld ]), [ gated ]);
  });

  it('does not advertise a successor with a missing required upgrade', function() {
    const latestOld = withRecipe(template('old', 3, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3
    });
    assert.deepStrictEqual(findSuccessors([ fresh ], 'old', 1, [ latestOld ]), []);
  });
});

describe('recipe owner and floor selection', function() {
  it('validates owner relations even on unselected entries', function() {
    for (const source of [ {
      kind: 'upgrade',
      sourceTemplateId: 'other',
      toVersion: 1
    }, {
      kind: 'upgrade',
      sourceTemplateId: 't',
      toVersion: 4
    }, {
      kind: 'change',
      sourceTemplateId: 't'
    } ]) {
      const target = withRecipe(template('t', 3, []), source);
      assert.throws(() => resolveSteps({
        appliedId: 't',
        appliedVersion: 2,
        target,
        templates: [ target ]
      }), /owner|version/);
    }
  });

  it('chooses one highest reachable floor and otherwise the omitted floor', function() {
    const target = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      paths: [ {
        to: 'x',
        set: 'fallback'
      } ]
    }, {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 5,
      paths: [ {
        to: 'x',
        set: 'five'
      } ]
    }, {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 2,
      paths: [ {
        to: 'x',
        set: 'two'
      } ]
    });
    for (const [ appliedVersion, expected ] of [ [ 1, 'fallback' ], [ 4, 'two' ], [ 5, 'five' ] ]) {
      assert.ok(typeof appliedVersion === 'number');
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion,
        target,
        templates: [ target ]
      });
      assert.strictEqual(result.steps.length, 1);
      const entry = result.steps[0].entries[0];
      assert.ok(entry.kind === 'set');
      assert.strictEqual(entry.value, expected);
    }
  });
});

describe('resolveApplications', function() {
  const v1 = template('t', 1, []);
  const v2 = template('t', 2, []);
  const v3 = template('t', 3, []);

  it('appends a recipe-free application of the target when steps end short', function() {
    const apps = resolveApplications([ v1, v2, v3 ], [ {
      kind: 'version',
      templateId: 't',
      version: 2,
      entries: []
    } ], v3);
    assert.deepStrictEqual(apps.map(a => [ a.template.version, a.step === null ]), [ [ 2, false ], [ 3, true ] ]);
  });

  it('does not repeat the target when the last step produces it', function() {
    const apps = resolveApplications([ v1, v2 ], [ {
      kind: 'version',
      templateId: 't',
      version: 2,
      entries: []
    } ], v2);
    assert.strictEqual(apps.length, 1);
  });

  it('throws when a step template is not available', function() {
    assert.throws(() => resolveApplications([ v1 ], [ {
      kind: 'version',
      templateId: 't',
      version: 5,
      entries: []
    } ], v1), /"t" version 5 is not available/);
  });
});

describe('catalog identity conflicts', function() {
  it('rejects successor identities conflicting across candidates and catalog', function() {
    const candidate = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old'
    });
    const shadow = {
      ...candidate,
      name: 'Conflicting catalog content'
    };
    for (const [ candidates, templates ] of [ [ [ candidate ], [ shadow ] ], [ [ shadow ], [ candidate ] ] ]) {
      assert.throws(() => findSuccessors(candidates, 'old', 1, templates), /Conflicting.*new.*version 1/);
    }
  });

  it('reports the same identity when multiple conflicts are reordered', function() {
    const a = template('a', 2, []);
    const b = template('b', 1, []);
    const catalog = [ b, {
      ...b,
      name: 'other'
    }, a, {
      ...a,
      name: 'other'
    } ];
    const errors = [];
    for (const templates of [ catalog, catalog.toReversed(), [ ...catalog.slice(2), ...catalog.slice(0, 2) ] ]) {
      assert.throws(() => resolveCatalog(templates), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Conflicting.*"a" version 2/);
        errors.push(error.message);
        return true;
      });
    }
    assert.ok(errors.every(error => error === errors[0]));
  });

  it('treats a versionless definition and version 0 as one identity', function() {
    const versionless = {
      ...template('old', 0, []),
      version: undefined
    };
    assert.throws(() => resolveCatalog([ versionless, {
      ...template('old', 0, []),
      name: 'v0'
    } ]), /Conflicting.*"old"/);
    assert.strictEqual(latestOf([ versionless ], 'old'), versionless);
  });

  it('accepts identical content with different object key order without mutating inputs', function() {
    const original = template('old', 2, [ 'b' ]);
    const duplicate = {
      properties: [ {
        binding: {
          name: 'b',
          type: 'zeebe:input'
        }
      } ],
      version: 2,
      id: 'old'
    };
    const templates = [ original, original, duplicate ];
    const before = structuredClone(templates);
    assert.deepStrictEqual(resolveCatalog(templates), [ original ]);
    assert.deepStrictEqual(templates, before);
  });
  for (const [ name, left, right, equal ] of [ [ 'undefined vs missing key', {
    a: undefined
  }, {}, false ], [ 'array vs object', [ 1 ], {
    0: 1
  }, false ], [ 'nested arrays', [ [ 1, [ 2 ] ] ], [ [ 1, [ 2 ] ] ], true ], [ 'nested array order', [ [ 1, 2 ] ], [ [ 2, 1 ] ], false ], [ 'null vs object', null, {}, false ], [ 'null vs null', null, null, true ] ]) {
    it(`compares content for ${name}`, function() {
      const templates = [ {
        ...template('old', 2, []),
        extra: left
      }, {
        ...template('old', 2, []),
        extra: right
      } ];
      if (equal) assert.equal(resolveCatalog(templates).length, 1);else assert.throws(() => resolveCatalog(templates), /Conflicting/);
    });
  }
  for (const reverse of [ false, true ]) {
    for (const difference of [ 'bindings', 'metadata', 'defaults', 'conditions' ]) {
      it(`rejects ${difference} conflicts at every selection entry point (reverse=${reverse})`, function() {
        const original = template('old', 2, [ 'b' ]);
        const shadow = {
          ...original,
          ...(difference === 'metadata' ? {
            metadata: {
              migratesFrom: {
                schemaVersion: 99,
                sources: []
              }
            }
          } : {
            properties: [ {
              ...prop(difference === 'bindings' ? 'stale' : 'b'),
              ...(difference === 'defaults' ? {
                value: 'stale'
              } : {}),
              ...(difference === 'conditions' ? {
                condition: {
                  property: 'mode',
                  equals: 'off'
                }
              } : {})
            } ]
          })
        };
        const templates = reverse ? [ shadow, original ] : [ original, shadow ];
        const target = withRecipe(template('new', 1, []), {
          kind: 'change',
          sourceTemplateId: 'old'
        });
        for (const select of [ () => latestOf(templates, 'old'), () => resolveSteps({
          appliedId: 'old',
          appliedVersion: 1,
          target,
          templates
        }), () => resolveApplications(templates, [ {
          kind: 'version',
          templateId: 'old',
          version: 2,
          entries: []
        } ], target), () => findSuccessors([ target ], 'old', 1, templates), () => findSuccessors(templates, 'source', 1, []) ]) assert.throws(select, /Conflicting.*old.*version 2/);
      });
    }
    it(`explicit target replaces catalog shadows in standalone selection (reverse=${reverse})`, function() {
      const target = withRecipe(template('old', 2, [ 'b' ]), {
        kind: 'upgrade',
        sourceTemplateId: 'old',
        toVersion: 2
      });
      const shadow = {
        ...target,
        metadata: {
          migratesFrom: {
            schemaVersion: 99,
            sources: []
          }
        }
      };
      const templates = reverse ? [ shadow, template('old', 1, []) ] : [ template('old', 1, []), shadow ];
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target,
        templates
      });
      assert.strictEqual(result.refusal, null);
      assert.strictEqual(resolveApplications(templates, result.steps, target)[0].template, target);
    });
  }
});

describe('Option B selection boundaries', function() {
  it('coverage uses the reached shape, never an unselected catalog version', function() {
    for (const paths of [ [ {
      from: 'a',
      to: 'z'
    } ], [ {
      template: '${a}',
      to: 'z'
    } ], [ {
      set: 'value',
      to: 'z',
      when: {
        path: 'a',
        equals: 'value'
      }
    } ] ]) {
      for (const sameId of [ true, false ]) {
        for (const available of [ true, false ]) {
          const applied = template('old', 1, available ? [ 'a' ] : []);
          const unselected = template('old', 2, available ? [] : [ 'a' ]);
          const source = withRecipe(template('old', 3, [ 'z' ]), {
            kind: 'upgrade',
            sourceTemplateId: 'old',
            toVersion: 3,
            paths
          });
          const successor = withRecipe(template('new', 9, []), {
            kind: 'change',
            sourceTemplateId: 'old',
            minSourceVersion: 3
          });
          const target = sameId ? source : successor;
          const templates = [ applied, unselected, source ];
          const result = resolveSteps({
            appliedId: 'old',
            appliedVersion: 1,
            target,
            templates
          });
          assert.strictEqual(result.refusal === null, available);
          assert.strictEqual(result.steps.length, available ? sameId ? 1 : 2 : 0);
          assert.deepStrictEqual(findSuccessors([ successor ], 'old', 1, templates), available ? [ successor ] : []);
        }
      }
    }
  });

  it('coverage does not retain writes removed by a later selected application', function() {
    const source = withRecipe(template('old', 4, [ 'z' ]), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2,
      paths: [ {
        from: 'a',
        to: 'b'
      } ]
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 4,
      paths: [ {
        from: 'b',
        to: 'z'
      } ]
    });
    const successor = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 4
    });
    const templates = [ template('old', 1, [ 'a' ]), template('old', 2, [ 'b' ]), template('old', 3, []), source ];
    for (const target of [ source, successor ]) {
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target,
        templates
      });
      assert.deepStrictEqual(result.steps, []);
      assert.match(result.refusal ?? '', /version 4 reads "b".*version 3/);
    }
    assert.deepStrictEqual(findSuccessors([ successor ], 'old', 1, templates), []);
  });

  it('uses the supplied final target without requiring a duplicate catalog entry', function() {
    const recipe = recipeOf({
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3
    });
    const intermediate = template('old', 2, []);
    for (const embedded of [ true, false ]) {
      const target = template('old', 3, [], embedded ? {
        metadata: {
          migratesFrom: {
            schemaVersion: 1,
            sources: [ {
              kind: 'upgrade',
              sourceTemplateId: 'old',
              toVersion: 2
            }, {
              kind: 'upgrade',
              sourceTemplateId: 'old',
              toVersion: 3
            } ]
          }
        }
      } : {});
      const context = {
        appliedId: 'old',
        appliedVersion: 1,
        target,
        ...(embedded ? {} : {
          recipe
        })
      };
      const {
        steps,
        refusal
      } = resolveSteps({
        ...context,
        templates: [ intermediate ]
      });
      assert.strictEqual(refusal, null);
      const applications = resolveApplications([ intermediate ], steps, target);
      assert.deepStrictEqual(applications.map(application => application.template), [ intermediate, target ]);
      assert.strictEqual(applications[1].template, target);
      assert.throws(() => resolveSteps({
        ...context,
        templates: []
      }), /"old" version 2 is not available/);
    }
  });

  it('sorts markers, excludes applied equality and allows missing unselected versions and gaps', function() {
    const target = withRecipe(template('old', 5, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 5
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 1
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3,
      paths: []
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 0
    }, {
      kind: 'change',
      sourceTemplateId: 'other',
      minSourceVersion: 99
    });
    const templates = [ template('old', 3, []), target ];
    for (const [ appliedVersion, expected ] of [ [ 1, [ 3, 5 ] ], [ 3, [ 5 ] ], [ 5, [] ] ]) {
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion,
        target,
        templates
      });
      assert.strictEqual(result.refusal, null);
      assert.deepStrictEqual(result.steps.map(step => step.version), [ ...expected ]);
      assert.ok(result.steps.every(step => step.entries.length === 0));
    }
  });

  it('uses only the latest source recipe and keeps it separate from a mixed target override', function() {
    const older = withRecipe(template('old', 2, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2
    });
    const latest = withRecipe(template('old', 5, []), {
      kind: 'change',
      sourceTemplateId: 'unrelated',
      paths: [ {
        to: 'ignored',
        set: 'source change'
      } ]
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3,
      paths: []
    });
    const target = withRecipe(template('new', 9, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 5
    });
    const recipe = recipeOf({
      kind: 'upgrade',
      sourceTemplateId: 'new',
      toVersion: 8
    }, {
      kind: 'change',
      sourceTemplateId: 'other'
    }, {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 3,
      paths: [ {
        to: 'x',
        set: 'override'
      } ]
    });
    const templates = [ latest, older, template('old', 3, []), target ];
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates,
      recipe
    });
    assert.strictEqual(result.refusal, null);
    assert.deepStrictEqual(result.steps.map(step => [ step.kind, step.templateId, step.version ]), [ [ 'version', 'old', 3 ], [ 'hop', 'new', 9 ] ]);
    assert.deepStrictEqual(result.steps[1].entries, recipe.sources[2].entries);
    const embedded = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates
    });

    // The embedded floor of 5 is reached by an implicit step after the upgrade to 3.
    assert.strictEqual(embedded.refusal, null);
    assert.deepStrictEqual(embedded.steps.map(step => [ step.kind, step.version, step.implicit ]), [ [ 'version', 3, undefined ], [ 'version', 5, true ], [ 'hop', 9, undefined ] ]);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, templates), [ target ]);
  });

  it('latest source recipes without upgrades never borrow older upgrades or catalog reachability', function() {
    const older = withRecipe(template('old', 2, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2
    });
    const target = withRecipe(template('new', 99, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 2
    });
    for (const templates of [ [ template('old', 2, []) ], [ older, template('old', 5, []) ], [ older, withRecipe(template('old', 5, []), {
      kind: 'change',
      sourceTemplateId: 'other',
      paths: []
    }) ] ]) {
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target,
        templates
      });

      // The floor is met by an implicit step, never by borrowing an older upgrade.
      assert.strictEqual(result.refusal, null);
      assert.deepStrictEqual(result.steps.map(step => [ step.kind, step.version, step.implicit ]), [ [ 'version', 2, true ], [ 'hop', 99, undefined ] ]);
      assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, templates), [ target ]);
      assert.deepStrictEqual(findSuccessors([ target ], 'old', 2, templates), [ target ]);
    }

    // With no source version loaded at or above the floor there is nothing to climb to.
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: []
    }), /Template 'old' v2 or later is required/);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, []), []);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 2, []), [ target ]);
  });

  it('an omitted floor does not request an upgrade and a zero floor outranks it', function() {
    const target = withRecipe(template('new', 5, []), {
      kind: 'change',
      sourceTemplateId: 'old'
    }, {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 0,
      paths: [ {
        to: 'x',
        set: 'zero'
      } ]
    });
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 0,
      target,
      templates: [ template('old', 99, []) ]
    });
    assert.strictEqual(result.steps.length, 1);
    assert.strictEqual(result.steps[0].kind, 'hop');
    assert.strictEqual(result.steps[0].entries.length, 1);
    const omitted = withRecipe(template('new', 5, []), {
      kind: 'change',
      sourceTemplateId: 'old'
    });
    assert.deepStrictEqual(resolveSteps({
      appliedId: 'old',
      appliedVersion: 0,
      target: omitted,
      templates: []
    }).steps, [ {
      kind: 'hop',
      templateId: 'new',
      version: 5,
      entries: []
    } ]);
  });

  it('requires every selected upgrade even when the applied source template is unavailable', function() {
    const latest = withRecipe(template('old', 5, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 3
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 5
    });
    const target = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 5
    });
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ latest ]
    }), /"old" version 3 is not available/);
    const templates = [ latest, template('old', 3, []) ];
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates
    });
    assert.deepStrictEqual(result.steps.map(step => step.version), [ 3, 5, 1 ]);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, templates), [ target ]);
  });

  it('validates ignored target and latest-source entries before selection and successor discovery', function() {
    const target = withRecipe(template('new', 3, []), {
      kind: 'change',
      sourceTemplateId: 'old'
    });
    for (const source of [ {
      kind: 'invalid',
      sourceTemplateId: 'other'
    }, {
      kind: 'change',
      sourceTemplateId: 'other',
      extra: true
    }, {
      kind: 'change',
      sourceTemplateId: 'other',
      minVersion: 1
    }, {
      kind: 'change',
      sourceTemplateId: 'other',
      toVersion: 1
    }, {
      kind: 'change',
      sourceTemplateId: 'other',
      paths: [ {
        to: 'x',
        set: 'x',
        extra: true
      } ]
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'other',
      toVersion: 1
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'new',
      toVersion: 4
    }, {
      kind: 'change',
      sourceTemplateId: 'new'
    } ]) {
      const invalidTarget = withRecipe(target, {
        kind: 'change',
        sourceTemplateId: 'old'
      }, source);
      assert.throws(() => resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target: invalidTarget,
        templates: []
      }), /Invalid migration recipe/);
      assert.deepStrictEqual(findSuccessors([ invalidTarget ], 'old', 1, []), []);
    }
    for (const source of [ {
      kind: 'change',
      sourceTemplateId: 'other',
      minVersion: 1
    }, {
      kind: 'change',
      sourceTemplateId: 'old'
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'other',
      toVersion: 1
    }, {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 4
    } ]) {
      const latest = withRecipe(template('old', 3, []), source);
      assert.throws(() => resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target,
        templates: [ latest ]
      }), /Invalid migration recipe/);
      assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, [ latest ]), []);
    }
  });

  it('coverage refusal prevents a successor even when every step template is loaded', function() {
    const latest = withRecipe(template('old', 2, []), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2,
      paths: [ {
        from: 'missing',
        to: 'x'
      } ]
    });
    const target = withRecipe(template('new', 1, []), {
      kind: 'change',
      sourceTemplateId: 'old',
      minSourceVersion: 2
    });
    const templates = [ template('old', 1, []), latest ];
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates
    });
    assert.deepStrictEqual(result.steps, []);
    assert.match(result.refusal ?? '', /reads "missing"/);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, templates), []);
  });
});

describe('resolveSteps and findSuccessors boundary cases', function() {
  const upgradeTo2 = {
    kind: 'upgrade',
    sourceTemplateId: 't',
    toVersion: 2,
    paths: [ {
      from: 'a',
      to: 'b'
    } ]
  };

  it('an applied version above the target without a recipe resolves to nothing', function() {
    const target = template('t', 2, [ 'b' ]);
    const result = resolveSteps({
      appliedId: 't',
      appliedVersion: 3,
      target,
      templates: [ target ]
    });
    assert.deepStrictEqual(result, {
      steps: [],
      refusal: null
    });
  });

  it('an applied version above the target with a recipe is refused with the version gap', function() {
    const target = withRecipe(template('t', 2, [ 'b' ]), upgradeTo2);
    const result = resolveSteps({
      appliedId: 't',
      appliedVersion: 3,
      target,
      templates: [ target ]
    });
    assert.deepStrictEqual(result.steps, []);
    assert.match(result.refusal ?? '', /no applicable upgrade: .*above applied version 3 through target version 2/);
  });

  it('an applied version below a target the recipe has no upgrade for carries values over', function() {
    const v2 = template('t', 2, [ 'b' ]);
    const target = withRecipe(template('t', 3, [ 'b' ]), upgradeTo2);
    const result = resolveSteps({
      appliedId: 't',
      appliedVersion: 2,
      target,
      templates: [ v2, target ]
    });
    assert.deepStrictEqual(result, {
      steps: [],
      refusal: null
    });
  });

  it('a recipe upgrade below the target still applies before the carry-over to the target', function() {
    const v2 = template('t', 2, [ 'b' ]);
    const target = withRecipe(template('t', 3, [ 'b' ]), upgradeTo2);
    const result = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target,
      templates: [ template('t', 1, [ 'a' ]), v2, target ]
    });
    assert.strictEqual(result.refusal, null);
    assert.deepStrictEqual(result.steps.map(s => [ s.kind, s.version ]), [ [ 'version', 2 ] ]);
  });

  it('a target without a version is treated as version 0 and never throws', function() {
    const {
      version: _version,
      ...target
    } = template('t', 0, [ 'b' ]);
    const result = resolveSteps({
      appliedId: 't',
      appliedVersion: 1,
      target,
      templates: [ target ]
    });
    assert.deepStrictEqual(result, {
      steps: [],
      refusal: null
    });
  });

  it('only the newest non-deprecated successor version is offered', function() {
    const applied = template('old', 1, [ 'a' ]);
    const change = {
      kind: 'change',
      sourceTemplateId: 'old',
      paths: [ {
        from: 'a',
        to: 'a'
      } ]
    };
    const v1 = withRecipe(template('new', 1, [ 'a' ]), change);
    const v2 = withRecipe(template('new', 2, [ 'a' ], {
      deprecated: true
    }), change);
    const found = findSuccessors([ v1, v2 ], 'old', 1, [ applied ]);
    assert.deepStrictEqual(found.map(t => [ t.id, t.version ]), [ [ 'new', 1 ] ]);
  });

  it('a successor candidate with the applied id is not a successor', function() {
    const applied = template('old', 1, [ 'a' ]);
    const newer = withRecipe(template('old', 2, [ 'a' ]), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2,
      paths: [ {
        from: 'a',
        to: 'a'
      } ]
    });
    assert.deepStrictEqual(findSuccessors([ newer ], 'old', 1, [ applied ]), []);
  });

  it('qualified recipe paths are checked against the binding type of the applied shape', function() {
    const applied = template('t', 1, [ 'a' ]);
    const upgrade = from => withRecipe(template('t', 2, [ 'b' ]), {
      kind: 'upgrade',
      sourceTemplateId: 't',
      toVersion: 2,
      paths: [ {
        from,
        to: 'b'
      } ]
    });
    for (const [ from, covered ] of [ [ 'input:a', true ], [ 'a', true ], [ 'header:a', false ], [ 'output:a', false ] ]) {
      const target = upgrade(from);
      const result = resolveSteps({
        appliedId: 't',
        appliedVersion: 1,
        target,
        templates: [ applied, target ]
      });
      if (covered) {
        assert.strictEqual(result.refusal, null, from);
        assert.strictEqual(result.steps.length, 1, from);
      } else {
        assert.match(result.refusal ?? '', /is incomplete: .*reads/, from);
        assert.deepStrictEqual(result.steps, [], from);
      }
    }
  });
});

describe('hop coverage', function() {
  const hopReading = (from, minSourceVersion) => withRecipe(template('new', 1, [ 'x' ]), {
    kind: 'change',
    sourceTemplateId: 'old',
    ...(minSourceVersion === undefined ? {} : {
      minSourceVersion
    }),
    paths: [ {
      from,
      to: 'x'
    } ]
  });

  it('refuses a hop reading a path the reached source does not define', function() {
    const target = hopReading('misspelled');
    const templates = [ template('old', 1, [ 'a' ]) ];
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates
    });
    assert.deepStrictEqual(result.steps, []);
    assert.match(result.refusal ?? '', /recipe for new is incomplete: the change from old reads "misspelled", which reached version 1 does not define/);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, templates), []);
  });

  it('refuses a guard on a path the reached source does not define, whatever its shape', function() {
    for (const when of [ {
      path: 'misspelled',
      equals: 'x'
    }, {
      path: 'misspelled',
      equals: 'x',
      not: true
    }, {
      path: 'misspelled',
      exists: true
    }, {
      path: 'misspelled',
      exists: false
    } ]) {
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target: withRecipe(template('new', 1, [ 'x' ]), {
          kind: 'change',
          sourceTemplateId: 'old',
          paths: [ {
            to: 'x',
            set: 'y',
            when
          } ]
        }),
        templates: [ template('old', 1, [ 'a' ]) ]
      });
      assert.match(result.refusal ?? '', /reads "misspelled"/, JSON.stringify(when));
    }
  });

  it('checks the hop against the shape the last rung reached', function() {
    const latest = withRecipe(template('old', 2, [ 'b' ]), {
      kind: 'upgrade',
      sourceTemplateId: 'old',
      toVersion: 2,
      paths: [ {
        from: 'a',
        to: 'b'
      } ]
    });
    const templates = [ template('old', 1, [ 'a' ]), latest ];
    for (const [ from, covered ] of [ [ 'b', true ], [ 'a', false ] ]) {
      const result = resolveSteps({
        appliedId: 'old',
        appliedVersion: 1,
        target: hopReading(from, 2),
        templates
      });
      if (covered) {
        assert.strictEqual(result.refusal, null, from);
        assert.deepStrictEqual(result.steps.map(step => step.kind), [ 'version', 'hop' ]);
      } else {
        assert.match(result.refusal ?? '', /reads "a".*version 2/, from);
        assert.deepStrictEqual(result.steps, [], from);
      }
    }
  });

  it('skips the check when the reached source is not in the catalog', function() {
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target: hopReading('misspelled'),
      templates: []
    });
    assert.strictEqual(result.refusal, null);
    assert.deepStrictEqual(result.steps.map(step => step.kind), [ 'hop' ]);
  });
});

describe('implicit update to the recipe floor', function() {
  const change = (minSourceVersion, to = 'x') => ({
    kind: 'change',
    sourceTemplateId: 'old',
    ...(minSourceVersion === undefined ? {} : {
      minSourceVersion
    }),
    paths: [ {
      to,
      set: `floor-${minSourceVersion ?? 'none'}`
    } ]
  });
  const lineage = (...versions) => versions.map(v => template('old', v, [ 'a' ]));

  it('adds one implicit version step to the floor, then the hop', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(3));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 2, 3), target ],
      engineVersion: '8.8'
    });
    assert.strictEqual(result.refusal, null);
    assert.deepStrictEqual(result.steps.map(s => [ s.kind, s.templateId, s.version, s.implicit ]), [ [ 'version', 'old', 3, true ], [ 'hop', 'new', 1, undefined ] ]);
    assert.deepStrictEqual(result.steps[0].entries, []);
  });

  it('uses the highest floor at most the newest compatible version', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(2), change(4), change(7));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 2, 3, 4, 5), target ],
      engineVersion: '8.8'
    });
    assert.deepStrictEqual(result.steps.map(s => [ s.kind, s.version ]), [ [ 'version', 4 ], [ 'hop', 1 ] ]);
    const entry = result.steps[1].entries[0];
    assert.ok(entry.kind === 'set');
    assert.strictEqual(entry.value, 'floor-4');
  });

  it('does not bump when the reached version already meets the floor', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(2));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 2,
      target,
      templates: [ ...lineage(2, 3), target ],
      engineVersion: '8.8'
    });
    assert.deepStrictEqual(result.steps.map(s => s.kind), [ 'hop' ]);
  });

  it('an omitted-floor entry never triggers a bump', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change());
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 5), target ],
      engineVersion: '8.8'
    });
    assert.deepStrictEqual(result.steps.map(s => s.kind), [ 'hop' ]);
  });

  it('throws when the newest compatible version is below the lowest floor', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(5), change(6));
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 4), target ],
      engineVersion: '8.7'
    }), /Template 'old' v5 or later is required, but the newest version compatible with Camunda 8\.7 \(from the BPMN executionPlatformVersion\) is v4\./);
  });

  it('an unavailable applied stand-in is not reported as a compatible version', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(6));
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 5,
      appliedShapeKnown: false,
      target,
      templates: [ ...lineage(4, 5), target ],
      engineVersion: '8.8'
    }), /is v4\./);
  });

  it('a floor missing from the compatible catalog lands on the lowest compatible version above it', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(3));
    const input = {
      appliedId: 'old',
      appliedVersion: 1,
      templates: [ ...lineage(1, 2, 4), target ],
      engineVersion: '8.8'
    };
    const embedded = resolveSteps({
      ...input,
      target
    });
    assert.deepStrictEqual(embedded.steps.map(s => [ s.kind, s.version, s.implicit ]), [ [ 'version', 4, true ], [ 'hop', 1, undefined ] ]);
    const plain = template('new', 1, [ 'x' ]);
    const explicit = resolveSteps({
      ...input,
      target: plain,
      templates: [ ...lineage(1, 2, 4), plain ],
      recipe: recipeOf(change(3))
    });
    assert.deepStrictEqual(explicit.steps.map(s => [ s.kind, s.version, s.implicit ]), [ [ 'version', 4, true ], [ 'hop', 1, undefined ] ]);
  });

  it('an explicit recipe behaves like an embedded one', function() {
    const target = template('new', 1, [ 'x' ]);
    const recipe = recipeOf(change(3));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 3), target ],
      recipe,
      engineVersion: '8.8'
    });
    assert.deepStrictEqual(result.steps.map(s => [ s.kind, s.version, s.implicit ]), [ [ 'version', 3, true ], [ 'hop', 1, undefined ] ]);
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 2), target ],
      recipe,
      engineVersion: '8.8'
    }), /v3 or later is required/);
  });

  it('an engine-incompatible applied version is not named as compatible', function() {
    const incompatible = t => t.version !== 5;
    const target = withRecipe(template('new', 1, [ 'x' ]), change(6));
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 5,
      target,
      templates: [ ...lineage(4, 5), target ],
      engineVersion: '8.8',
      isCompatible: incompatible
    }), /is required, but the newest version compatible with Camunda 8\.8.*is v4\./);
  });

  it('an incompatible version at or above the floor is not a landing version', function() {
    const incompatible = t => t.version !== 1;
    const target = withRecipe(template('new', 1, [ 'x' ]), change(2));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1, 3, 4), target ],
      engineVersion: '8.8',
      isCompatible: incompatible
    });
    assert.deepStrictEqual(result.steps.map(s => [ s.kind, s.version ]), [ [ 'version', 3 ], [ 'hop', 1 ] ]);
  });

  it('reports that no compatible source version exists when the catalog is empty', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(2));
    assert.throws(() => resolveSteps({
      appliedId: 'old',
      appliedVersion: 1,
      target,
      templates: [ ...lineage(1), target ],
      engineVersion: '8.8',
      isCompatible: t => t.id !== 'old'
    }), /Template 'old' v2 or later is required, but no version compatible with Camunda 8\.8 \(from the BPMN executionPlatformVersion\) is available\./);
  });

  it('an applied version above an unreachable floor does not throw', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(5));
    const result = resolveSteps({
      appliedId: 'old',
      appliedVersion: 5,
      target,
      templates: [ ...lineage(4, 5), target ],
      engineVersion: '8.8',
      isCompatible: t => t.version !== 5
    });
    assert.deepStrictEqual(result.steps.map(s => s.kind), [ 'hop' ]);
  });

  it('findSuccessors advertises a successor reachable through an implicit step', function() {
    const target = withRecipe(template('new', 1, [ 'x' ]), change(3));
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, lineage(1, 3)), [ target ]);
    assert.deepStrictEqual(findSuccessors([ target ], 'old', 1, lineage(1, 2)), []);
  });
});
