// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Unit tests for the migration report builder
 * (default-plugins/element-template/migration/report.ts)
 */

import assert from 'assert';
import { buildReport, mergeFacts } from '../../../src/migration/report.js';
function value(key, v) {
  return {
    bindingType: 'zeebe:input',
    key,
    value: v,
    isFeel: false
  };
}
function facts(partial = {}) {
  return {
    moved: [],
    set: [],
    notes: [],
    guardSkipped: [],
    templateSkipped: [],
    noMatch: [],
    feelSkipped: [],
    ...partial
  };
}
const oldTemplate = {
  id: 'old',
  version: 1,
  name: 'Old',
  deprecated: true,
  groups: [ {
    id: 'model',
    label: 'Model'
  } ],
  properties: [ {
    label: 'Maximum tokens',
    group: 'model',
    binding: {
      type: 'zeebe:input',
      name: 'maxTokens'
    }
  }, {
    label: 'Provider',
    group: 'model',
    choices: [ {
      name: 'Azure OpenAI',
      value: 'azure'
    } ],
    binding: {
      type: 'zeebe:input',
      name: 'provider'
    }
  } ]
};
const newTemplate = {
  id: 'new',
  version: 1,
  name: 'New',
  groups: [ {
    id: 'model',
    label: 'Model'
  } ],
  properties: [ {
    label: 'Provider',
    group: 'model',
    choices: [ {
      name: 'OpenAI',
      value: 'openai'
    } ],
    binding: {
      type: 'zeebe:input',
      name: 'provider'
    }
  }, {
    label: 'Effort',
    group: 'model',
    binding: {
      type: 'zeebe:input',
      name: 'effort'
    }
  }, {
    type: 'Hidden',
    binding: {
      type: 'zeebe:input',
      name: 'internal'
    }
  } ]
};

describe('buildReport', function() {
  for (const actual of [ 'unrelated', '' ]) {
    it(`does not claim an unresolved move to ${JSON.stringify(actual)}`, function() {
      const report = buildReport({
        fromTemplate: oldTemplate,
        toTemplate: newTemplate,
        before: [ value('maxTokens', 'secret') ],
        after: [ value('effort', actual) ],
        facts: facts({
          moved: [ {
            from: {
              key: 'maxTokens',
              bindingType: 'zeebe:input'
            },
            to: {
              key: 'effort',
              bindingType: 'zeebe:input'
            },
            transformed: false
          } ]
        }),
        usedRecipe: true,
        refusal: null
      });
      assert.deepStrictEqual(report.moved, []);
      assert.deepStrictEqual(report.dropped.map(item => item.value), [ 'secret' ]);
      assert.strictEqual(report.lossless, false);
    });
  }

  it('reports only the final static addition when several steps write the same field', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [],
      after: [ value('effort', 'final') ],
      facts: mergeFacts([ facts({
        set: [ {
          key: 'effort',
          bindingType: 'zeebe:input',
          value: 'first'
        } ]
      }), facts({
        set: [ {
          key: 'effort',
          bindingType: 'zeebe:input',
          value: 'final'
        } ]
      }) ]),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.added.map(item => item.value), [ 'final' ]);
    assert.strictEqual(report.lossless, true);
  });

  it('reports a mismatched static write as the actual change instead of an addition', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'openai') ],
      facts: facts({
        set: [ {
          key: 'provider',
          bindingType: 'zeebe:input',
          value: 'expected'
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.added, []);
    assert.strictEqual(report.changed[0]?.valueChange.to, 'openai');
    assert.strictEqual(report.lossless, false);
  });

  it('does not claim removed intermediate moves or static additions', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('maxTokens', 'secret') ],
      after: [],
      facts: facts({
        moved: [ {
          from: {
            key: 'maxTokens',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'intermediate',
            bindingType: 'zeebe:input'
          },
          transformed: false
        } ],
        set: [ {
          key: 'temporary',
          bindingType: 'zeebe:input',
          value: 'gone'
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.moved, []);
    assert.deepStrictEqual(report.added, []);
    assert.strictEqual(report.dropped.length, 1);
    assert.strictEqual(report.lossless, false);
  });

  it('a fact without a binding type matches the element value under any binding type', function() {

    // `sameTarget` (binding.ts) treats a null binding type as a wildcard.
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('maxTokens', '2000') ],
      after: [ value('effort', '2000') ],
      facts: facts({
        moved: [ {
          from: {
            key: 'maxTokens',
            bindingType: null
          },
          to: {
            key: 'effort',
            bindingType: null
          },
          transformed: false
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.strictEqual(report.moved.length, 1);
    assert.deepStrictEqual(report.dropped, []);
  });

  it('lists values the new template does not bind as dropped, with labels', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('maxTokens', '2000'), value('provider', 'azure') ],
      after: [ value('provider', 'openai') ],
      facts: facts(),
      usedRecipe: false,
      refusal: null
    });
    assert.deepStrictEqual(report.dropped.map(d => [ d.label, d.groupLabel, d.value ]), [ [ 'Maximum tokens', 'Model', '2000' ] ]);
    assert.strictEqual(report.lossless, false);
  });

  it('reports values the template brought as added, but not hidden ones', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [],
      after: [ value('effort', 'default'), value('internal', 'x') ],
      facts: facts(),
      usedRecipe: false,
      refusal: null
    });
    assert.deepStrictEqual(report.added.map(a => a.key), [ 'effort' ]);
  });

  it('reports a replaced value under the same key as changed, with choice names', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'openai') ],
      facts: facts(),
      usedRecipe: false,
      refusal: null
    });
    assert.deepStrictEqual(report.changed[0].valueChange, {
      from: 'azure',
      to: 'openai',
      fromName: 'Azure OpenAI',
      toName: 'OpenAI'
    });
  });

  it('does not drop, add or change what a recipe moved', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('maxTokens', '2000') ],
      after: [ value('effort', '2000') ],
      facts: facts({
        moved: [ {
          from: {
            key: 'maxTokens',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'effort',
            bindingType: 'zeebe:input'
          },
          transformed: false
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.dropped, []);
    assert.deepStrictEqual(report.added, []);
    assert.strictEqual(report.moved.length, 1);
    assert.strictEqual(report.moved[0].from.label, 'Maximum tokens');
    assert.strictEqual(report.moved[0].to.label, 'Effort');
    assert.strictEqual(report.lossless, true);
  });

  it('shows the value change of a translated move', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'openai') ],
      facts: facts({
        moved: [ {
          from: {
            key: 'provider',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'provider',
            bindingType: 'zeebe:input'
          },
          transformed: true
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.strictEqual(report.moved[0].valueChange?.fromName, 'Azure OpenAI');
    assert.strictEqual(report.moved[0].valueChange?.toName, 'OpenAI');
    assert.deepStrictEqual(report.changed, []);
  });

  it('reports a recipe set over a prior value as a recipe change', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('provider', 'azure'), value('effort', 'high') ],
      after: [ value('provider', 'openai'), value('effort', 'high') ],
      facts: facts({
        set: [ {
          key: 'provider',
          bindingType: 'zeebe:input',
          value: 'openai'
        }, {
          key: 'effort',
          bindingType: 'zeebe:input',
          value: 'high'
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.added, []);
    assert.deepStrictEqual(report.changed.map(c => [ c.key, c.valueChange.from, c.source ]), [ [ 'provider', 'azure', 'recipe' ] ]);
    assert.deepStrictEqual(report.kept.map(k => k.key), [ 'effort' ]);
    assert.deepStrictEqual(report.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'provider', 'azure', 'displaced' ] ]);
    assert.strictEqual(report.lossless, false);
  });

  it('lists set values as added and carries notes', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [],
      after: [ value('effort', 'high') ],
      facts: facts({
        set: [ {
          key: 'effort',
          bindingType: 'zeebe:input',
          value: 'high'
        } ],
        notes: [ {
          level: 'warning',
          message: 'careful'
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.added.map(a => [ a.key, a.value ]), [ [ 'effort', 'high' ] ]);
    assert.deepStrictEqual(report.notes, [ {
      level: 'warning',
      message: 'careful'
    } ]);
  });

  it('ignores empty source values when computing drops', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('maxTokens', '') ],
      after: [],
      facts: facts(),
      usedRecipe: false,
      refusal: null
    });
    assert.deepStrictEqual(report.dropped, []);
  });

  it('is not lossless when a guard skipped a populated value', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [],
      after: [],
      facts: facts({
        guardSkipped: [ {
          from: 'a',
          to: 'b'
        } ]
      }),
      usedRecipe: true,
      refusal: null
    });
    assert.strictEqual(report.lossless, false);
  });
});

describe('mergeFacts', function() {
  it('a rename replaces an older addition at its destination', function() {
    const merged = mergeFacts([ facts({
      set: [ {
        key: 'b',
        bindingType: 'zeebe:input',
        value: 'old'
      } ],
      after: [ value('a', 'secret'), value('b', 'old') ]
    }), facts({
      moved: [ {
        from: {
          key: 'a',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        transformed: false,
        value: 'secret'
      } ],
      after: [ value('b', 'secret') ]
    }) ]);
    assert.deepStrictEqual(merged.set, []);
    assert.strictEqual(merged.failedWrites, false);
  });

  it('a forwarded addition replaces an older move to the same destination', function() {
    const merged = mergeFacts([ facts({
      moved: [ {
        from: {
          key: 'a',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'c',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ],
      set: [ {
        key: 'b',
        bindingType: 'zeebe:input',
        value: 'secret'
      } ]
    }), facts({
      moved: [ {
        from: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'c',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ]
    }) ]);
    assert.deepStrictEqual(merged.moved, []);
    assert.deepStrictEqual(merged.set.map(write => write.key), [ 'c' ]);
  });

  it('keeps different binding types independent when overwriting lineage', function() {
    const merged = mergeFacts([ facts({
      moved: [ {
        from: {
          key: 'a',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ]
    }), facts({
      set: [ {
        key: 'b',
        bindingType: 'zeebe:taskHeader',
        value: 'header'
      } ]
    }) ]);
    assert.strictEqual(merged.moved.length, 1);
    assert.strictEqual(merged.set[0]?.bindingType, 'zeebe:taskHeader');
  });

  it('forwards prior lineage before replacing its intermediate field in the same step', function() {
    const merged = mergeFacts([ facts({
      moved: [ {
        from: {
          key: 'a',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ]
    }), facts({
      moved: [ {
        from: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'c',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ],
      set: [ {
        key: 'b',
        bindingType: 'zeebe:input',
        value: 'replacement'
      } ]
    }) ]);
    assert.deepStrictEqual(merged.moved.map(move => [ move.from.key, move.to.key ]), [ [ 'a', 'c' ] ]);
  });

  it('chains a move across steps into one', function() {
    const merged = mergeFacts([ facts({
      moved: [ {
        from: {
          key: 'a',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        transformed: false
      } ]
    }), facts({
      moved: [ {
        from: {
          key: 'b',
          bindingType: 'zeebe:input'
        },
        to: {
          key: 'c',
          bindingType: 'zeebe:input'
        },
        transformed: true
      } ]
    }) ]);
    assert.deepStrictEqual(merged.moved.map(m => [ m.from.key, m.to.key, m.transformed ]), [ [ 'a', 'c', true ] ]);
  });
});

describe('buildReport over merged facts', function() {
  for (const bindingType of [ 'zeebe:input', 'zeebe:taskHeader' ]) {
    for (const reverse of [ false, true ]) {
      it(`reads simultaneous moves from the step snapshot (${bindingType}, reverse=${reverse})`, function() {
        const moves = [ {
          from: {
            key: 'a',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'b',
            bindingType
          },
          transformed: false,
          value: 'first'
        }, {
          from: {
            key: 'b',
            bindingType
          },
          to: {
            key: 'c',
            bindingType: 'zeebe:input'
          },
          transformed: false,
          value: 'second'
        } ];
        if (reverse) moves.reverse();
        const report = buildReport({
          fromTemplate: oldTemplate,
          toTemplate: newTemplate,
          before: [ value('a', 'first'), {
            ...value('b', 'second'),
            bindingType
          } ],
          after: [ {
            ...value('b', 'first'),
            bindingType
          }, value('c', 'second') ],
          facts: mergeFacts([ facts({
            moved: moves
          }) ]),
          usedRecipe: true,
          refusal: null
        });
        assert.deepStrictEqual(report.moved.map(move => [ move.from.key, move.to.key ]).sort(), [ [ 'a', 'b' ], [ 'b', 'c' ] ]);
        assert.deepStrictEqual(report.dropped, []);
        assert.strictEqual(report.lossless, true);
      });
    }
  }

  it('overwriting a move remains lossy when its original field still exists', function() {
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('a', 'secret') ],
      after: [ value('a', 'default'), value('b', 'replacement') ],
      facts: mergeFacts([ facts({
        moved: [ {
          from: {
            key: 'a',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'b',
            bindingType: 'zeebe:input'
          },
          transformed: false,
          value: 'secret'
        } ],
        after: [ value('b', 'secret') ]
      }), facts({
        set: [ {
          key: 'b',
          bindingType: 'zeebe:input',
          value: 'replacement'
        } ],
        after: [ value('a', 'default'), value('b', 'replacement') ]
      }) ]),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.moved, []);
    assert.strictEqual(report.lossless, false);
  });

  it('does not resurrect lineage when a removed destination is recreated later', function() {
    const merged = mergeFacts([ {
      ...facts({
        moved: [ {
          from: {
            key: 'a',
            bindingType: 'zeebe:input'
          },
          to: {
            key: 'b',
            bindingType: 'zeebe:input'
          },
          transformed: false
        } ]
      }),
      after: [ value('b', 'secret') ]
    }, {
      ...facts(),
      after: []
    }, {
      ...facts(),
      after: [ value('b', 'secret') ]
    } ]);
    const report = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('a', 'secret') ],
      after: [ value('b', 'secret') ],
      facts: merged,
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(report.moved, []);
    assert.strictEqual(report.dropped[0]?.value, 'secret');
    assert.strictEqual(report.lossless, false);
  });
});

describe('buildReport lossless rules', function() {
  const losslessWith = partial => buildReport({
    fromTemplate: oldTemplate,
    toTemplate: newTemplate,
    before: [ value('maxTokens', '2000') ],
    after: [ value('maxTokens', '2000') ],
    facts: facts(partial),
    usedRecipe: true,
    refusal: null
  }).lossless;

  it('is lossless when nothing was skipped or failed', function() {
    assert.strictEqual(losslessWith({}), true);
  });
  const cases = [ [ 'a guard-skipped entry', {
    guardSkipped: [ {
      from: 'a',
      to: 'b'
    } ]
  }, false ], [ 'a template entry with missing sources', {
    templateSkipped: [ {
      to: 'b',
      missing: [ 'a' ]
    } ]
  }, false ], [ 'a value map without a matching rule', {
    noMatch: [ {
      from: 'a',
      to: 'b'
    } ]
  }, false ], [ 'a failed write', {
    failedWrites: true
  }, false ],

  // Pinned: a FEEL expression moved as-is keeps its value, so it is not a loss.
  [ 'a FEEL expression moved as-is', {
    feelSkipped: [ {
      from: 'a',
      to: 'b'
    } ]
  }, true ] ];
  for (const [ name, partial, lossless ] of cases) {
    it(`${name} makes the report ${lossless ? 'still lossless' : 'lossy'}`, function() {
      assert.strictEqual(losslessWith(partial), lossless);
    });
  }
});

describe('buildReport unchecked bindings', function() {
  const correlationKey = {
    type: 'bpmn:Message#zeebe:subscription#property',
    name: 'correlationKey'
  };
  const withBinding = (id, properties) => ({
    id,
    version: 1,
    properties
  });
  const reportFor = target => buildReport({
    fromTemplate: withBinding('old', [ {
      id: 'key',
      label: 'Correlation key',
      binding: correlationKey
    }, {
      type: 'Hidden',
      value: 'x',
      binding: {
        type: 'zeebe:calledElement',
        property: 'processId'
      }
    } ]),
    toTemplate: withBinding('new', target),
    before: [],
    after: [],
    facts: facts(),
    usedRecipe: false,
    refusal: null
  });

  it('an identical editable binding on the target keeps the value', function() {
    const report = reportFor([ {
      binding: {
        ...correlationKey
      }
    } ]);
    assert.deepStrictEqual(report.skipped.unchecked, []);
    assert.strictEqual(report.lossless, true);
  });
  for (const [ name, target ] of [ [ 'a target without the binding', [] ], [ 'a target that binds it as Hidden', [ {
    type: 'Hidden',
    binding: correlationKey
  } ] ] ]) {
    it(`${name} makes the report lossy`, function() {
      const report = reportFor([ ...target ]);
      assert.deepStrictEqual(report.skipped.unchecked, [ {
        key: 'correlationKey',
        bindingType: correlationKey.type,
        label: 'Correlation key',
        propertyId: 'key'
      } ]);
      assert.strictEqual(report.lossless, false);
    });
  }
});

describe('buildReport item identity, values and sources', function() {
  const source = {
    id: 'source',
    version: 1,
    groups: [ {
      id: 'connection',
      label: 'Connection'
    }, {
      id: 'model',
      label: 'Model'
    } ],
    properties: [ {
      label: 'Max',
      group: 'model',
      binding: {
        type: 'zeebe:input',
        name: 'max'
      }
    }, {
      label: 'Url',
      group: 'connection',
      binding: {
        type: 'zeebe:input',
        name: 'url'
      }
    } ]
  };
  const target = {
    id: 'target',
    version: 1,
    groups: [ {
      id: 'model',
      label: 'Model'
    }, {
      id: 'options',
      label: 'Options'
    } ],
    properties: [ {
      type: 'Hidden',
      value: 't',
      binding: {
        type: 'zeebe:input',
        name: 'hidden'
      }
    }, {
      id: 'limit',
      label: 'Limit',
      group: 'options',
      binding: {
        type: 'zeebe:input',
        name: 'limit'
      }
    }, {
      label: 'Free',
      binding: {
        type: 'zeebe:input',
        name: 'free'
      }
    }, {
      id: 'effort',
      label: 'Effort',
      group: 'model',
      choices: [ {
        name: 'default',
        value: 'modelDefault'
      } ],
      binding: {
        type: 'zeebe:input',
        name: 'effort'
      }
    }, {
      id: 'model',
      label: 'Model',
      group: 'model',
      binding: {
        type: 'zeebe:input',
        name: 'model'
      }
    }, {
      label: 'Api',
      group: 'model',
      choices: [ {
        name: 'Chat Completions',
        value: 'completions'
      } ],
      binding: {
        type: 'zeebe:input',
        name: 'api'
      }
    }, {
      label: 'Prompt',
      group: 'options',
      binding: {
        type: 'zeebe:input',
        name: 'prompt'
      }
    }, {
      label: 'Mode',
      group: 'options',
      binding: {
        type: 'zeebe:input',
        name: 'mode'
      }
    } ]
  };
  const move = (from, to, extra = {}) => ({
    from: {
      key: from,
      bindingType: 'zeebe:input'
    },
    to: {
      key: to,
      bindingType: 'zeebe:input'
    },
    transformed: false,
    ...extra
  });
  const build = () => buildReport({
    fromTemplate: source,
    toTemplate: target,
    before: [ value('url', 'https://x'), value('max', '=1024'), value('free', 'f'), value('prompt', 'hi'), value('mode', 'a'), value('gone', 'lost'), value('legacy', 'kept'), value('hidden', 's'), value('empty', '') ],
    after: [ value('hidden', 't'), value('free', 'f'), value('legacy', 'kept'), value('empty', ''), value('limit', '=1024'), value('model', 'https://x'), value('prompt', 'hi'), value('mode', 'b'), value('api', 'completions'), value('effort', 'modelDefault') ],
    facts: facts({
      moved: [ move('max', 'limit'), move('url', 'model', {
        map: true
      }) ],
      set: [ {
        key: 'api',
        bindingType: 'zeebe:input',
        value: 'completions'
      } ]
    }),
    usedRecipe: true,
    refusal: null
  });

  it('reports group ID, group label and property ID, also when the label equals the group label', function() {
    const {
      moved
    } = build();
    assert.deepStrictEqual(moved.map(m => m.to), [ {
      key: 'model',
      bindingType: 'zeebe:input',
      label: 'Model',
      group: 'model',
      groupLabel: 'Model',
      propertyId: 'model'
    }, {
      key: 'limit',
      bindingType: 'zeebe:input',
      label: 'Limit',
      group: 'options',
      groupLabel: 'Options',
      propertyId: 'limit'
    } ]);
    assert.deepStrictEqual(moved[1].from, {
      key: 'max',
      bindingType: 'zeebe:input',
      label: 'Max',
      group: 'model',
      groupLabel: 'Model'
    });
  });

  it('carries the stored value and source on every moved item', function() {
    assert.deepStrictEqual(build().moved.map(m => [ m.to.key, m.value, m.source, m.valueChange ]), [ [ 'model', 'https://x', 'map', undefined ], [ 'limit', '=1024', 'recipe', undefined ] ]);
  });

  it('tells recipe values from template defaults in added and changed', function() {
    const report = build();
    assert.deepStrictEqual(report.added.map(a => [ a.key, a.value, a.valueName, a.source ]), [ [ 'effort', 'modelDefault', 'default', 'default' ], [ 'api', 'completions', 'Chat Completions', 'recipe' ] ]);
    assert.deepStrictEqual(report.changed.map(c => [ c.key, c.source ]), [ [ 'mode', 'default' ] ]);
  });

  it('lists unchanged, non-empty, non-hidden values as kept, without values', function() {
    assert.deepStrictEqual(build().kept, [ {
      key: 'prompt',
      bindingType: 'zeebe:input',
      label: 'Prompt',
      group: 'options',
      groupLabel: 'Options'
    }, {
      key: 'free',
      bindingType: 'zeebe:input',
      label: 'Free'
    }, {
      key: 'legacy',
      bindingType: 'zeebe:input'
    } ]);
  });

  it('orders dropped values by the source template', function() {
    const report = buildReport({
      fromTemplate: source,
      toTemplate: target,
      before: [ value('other', 'o'), value('max', '1'), value('url', 'u') ],
      after: [],
      facts: facts(),
      usedRecipe: false,
      refusal: null
    });
    assert.deepStrictEqual(report.dropped.map(d => d.key), [ 'url', 'max', 'other' ]);
  });
});

describe('buildReport: values lost to Hidden resets and displaced destinations', function() {
  const hidden = (template, key) => ({
    ...template,
    properties: [ ...template.properties.filter(p => p.binding?.name !== key), {
      type: 'Hidden',
      binding: {
        type: 'zeebe:input',
        name: key
      }
    } ]
  });
  const move = (from, to) => ({
    from: {
      key: from,
      bindingType: 'zeebe:input'
    },
    to: {
      key: to,
      bindingType: 'zeebe:input'
    },
    transformed: false
  });
  const report = ({
    fromTemplate = oldTemplate,
    toTemplate = newTemplate,
    before,
    after,
    moved = []
  }) => buildReport({
    fromTemplate,
    toTemplate,
    before,
    after,
    facts: facts({
      moved
    }),
    usedRecipe: moved.length > 0,
    refusal: null
  });

  it('an editable value reset by a Hidden target property is lost', function() {
    const r = report({
      toTemplate: hidden(newTemplate, 'provider'),
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'fixed') ]
    });
    assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'provider', 'azure', 'hidden' ] ]);
    assert.strictEqual(r.lossless, false);
  });

  it('an editable value equal to the Hidden default is kept', function() {
    const r = report({
      toTemplate: hidden(newTemplate, 'provider'),
      before: [ value('provider', 'fixed') ],
      after: [ value('provider', 'fixed') ]
    });
    assert.deepStrictEqual(r.dropped, []);
    assert.strictEqual(r.lossless, true);
  });

  it('a Hidden source value replaced by a new Hidden default is not lost', function() {
    const r = report({
      fromTemplate: hidden(oldTemplate, 'provider'),
      toTemplate: hidden(newTemplate, 'provider'),
      before: [ value('provider', 'v1-constant') ],
      after: [ value('provider', 'v2-constant') ]
    });
    assert.deepStrictEqual(r.dropped, []);
    assert.strictEqual(r.lossless, true);
  });

  it('an editable value moved away from a field that becomes Hidden is not lost', function() {
    const r = report({
      toTemplate: hidden(newTemplate, 'provider'),
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'fixed'), value('effort', 'azure') ],
      moved: [ move('provider', 'effort') ]
    });
    assert.deepStrictEqual(r.dropped, []);
    assert.strictEqual(r.lossless, true);
  });

  it('a move over a populated destination loses the old value', function() {
    const r = report({
      before: [ value('maxTokens', '2000'), value('effort', 'high') ],
      after: [ value('effort', '2000') ],
      moved: [ move('maxTokens', 'effort') ]
    });
    assert.strictEqual(r.moved.length, 1);
    assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'effort', 'high', 'displaced' ] ]);
    assert.strictEqual(r.lossless, false);
  });
  for (const [ name, prior ] of [ [ 'an empty', '' ], [ 'an equal', '2000' ] ]) {
    it(`a move over ${name} destination is lossless`, function() {
      const r = report({
        before: [ value('maxTokens', '2000'), value('effort', prior) ],
        after: [ value('effort', '2000') ],
        moved: [ move('maxTokens', 'effort') ]
      });
      assert.deepStrictEqual(r.dropped, []);
      assert.strictEqual(r.lossless, true);
    });
  }

  it('a swap keeps both values', function() {
    const r = report({
      before: [ value('provider', 'azure'), value('effort', 'high') ],
      after: [ value('provider', 'high'), value('effort', 'azure') ],
      moved: [ move('provider', 'effort'), move('effort', 'provider') ]
    });
    assert.deepStrictEqual(r.dropped, []);
    assert.strictEqual(r.lossless, true);
  });

  it('a value displaced in an earlier step stays lost when a later step moves it on', function() {
    const r = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: newTemplate,
      before: [ value('a', 'A'), value('b', 'B') ],
      after: [ value('b', 'A'), value('c', 'A') ],
      facts: mergeFacts([ facts({
        moved: [ {
          ...move('a', 'b'),
          value: 'A'
        } ],
        after: [ value('b', 'A') ]
      }), facts({
        moved: [ {
          ...move('b', 'c'),
          value: 'A'
        } ],
        after: [ value('b', 'A'), value('c', 'A') ]
      }) ]),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(r.moved.map(m => [ m.from.key, m.to.key ]), [ [ 'a', 'c' ] ]);
    assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'b', 'B', 'displaced' ] ]);
    assert.strictEqual(r.lossless, false);
  });
  const conditional = (type, value) => ({
    ...(type === 'Hidden' ? {
      type,
      value: 'fixed'
    } : {
      label: 'Provider'
    }),
    binding: {
      type: 'zeebe:input',
      name: 'provider'
    },
    condition: {
      property: 'mode',
      equals: value
    }
  });
  for (const hiddenFirst of [ true, false ]) {
    const order = (hidden, editable) => hiddenFirst ? [ hidden, editable ] : [ editable, hidden ];
    it(`a conditional Hidden target duplicate resets the value (Hidden first=${hiddenFirst})`, function() {
      const r = report({
        toTemplate: {
          ...newTemplate,
          properties: order(conditional('Hidden', 'on'), conditional('String', 'off'))
        },
        before: [ value('provider', 'azure') ],
        after: [ value('provider', 'fixed') ]
      });
      assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.cause ]), [ [ 'provider', 'hidden' ] ]);
      assert.strictEqual(r.lossless, false);
    });
    it(`a conditional Hidden source duplicate does not hide an editable value (Hidden first=${hiddenFirst})`, function() {
      const r = report({
        fromTemplate: {
          ...oldTemplate,
          properties: order(conditional('Hidden', 'on'), conditional('String', 'off'))
        },
        toTemplate: hidden(newTemplate, 'provider'),
        before: [ value('provider', 'azure') ],
        after: [ value('provider', 'fixed') ]
      });
      assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.cause ]), [ [ 'provider', 'hidden' ] ]);
      assert.strictEqual(r.lossless, false);
    });
  }

  it('a later move of a field reset by a Hidden property does not claim the original value', function() {
    const target = hidden({
      ...newTemplate,
      properties: [ ...newTemplate.properties, {
        label: 'Copy',
        binding: {
          type: 'zeebe:input',
          name: 'copy'
        }
      } ]
    }, 'region');
    const r = buildReport({
      fromTemplate: oldTemplate,
      toTemplate: target,
      before: [ value('region', 'eu-custom') ],
      after: [ value('region', 'fixed'), value('copy', 'fixed') ],
      facts: mergeFacts([ facts({
        after: [ value('region', 'fixed') ]
      }), facts({
        moved: [ {
          ...move('region', 'copy'),
          value: 'fixed'
        } ],
        after: [ value('region', 'fixed'), value('copy', 'fixed') ]
      }) ]),
      usedRecipe: true,
      refusal: null
    });
    assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'region', 'eu-custom', 'hidden' ] ]);
    assert.strictEqual(r.lossless, false);
  });

  it('a stub source cannot prove a Hidden source, so a Hidden target change counts as lost', function() {
    const r = report({
      fromTemplate: {
        ...oldTemplate,
        properties: []
      },
      toTemplate: hidden(newTemplate, 'provider'),
      before: [ value('provider', 'azure') ],
      after: [ value('provider', 'fixed') ]
    });
    assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.value, d.cause ]), [ [ 'provider', 'azure', 'hidden' ] ]);
    assert.strictEqual(r.lossless, false);
  });
  for (const sourceHidden of [ false, true ]) {
    it(`an intermediate Hidden reset is ${sourceHidden ? 'not ' : ''}lost when the source is ${sourceHidden ? '' : 'not '}Hidden`, function() {
      const r = buildReport({
        fromTemplate: sourceHidden ? hidden(oldTemplate, 'provider') : oldTemplate,
        toTemplate: newTemplate,
        before: [ value('provider', 'azure') ],
        after: [ value('provider', 'fixed') ],
        facts: mergeFacts([ facts({
          after: [ value('provider', 'fixed') ],
          reset: [ {
            key: 'provider',
            bindingType: 'zeebe:input',
            from: 'azure'
          } ]
        }) ]),
        usedRecipe: true,
        refusal: null
      });
      assert.deepStrictEqual(r.dropped.map(d => [ d.key, d.cause ]), sourceHidden ? [] : [ [ 'provider', 'hidden' ] ]);
      assert.strictEqual(r.lossless, sourceHidden);
    });
  }
});
