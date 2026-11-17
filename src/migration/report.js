// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * The migration report: what an element lost, gained and moved. Plain data;
 * rendering belongs to the caller.
 *
 * Built from the element's values before and after the migration plus what
 * the recipe steps reported, so it describes the outcome rather than the
 * intent of the recipe.
 */

import { bindingTargetKey, findPropertiesByTarget, sameTarget } from './binding.js';

/**
 * Where a value on the target came from. `fixed` (a Hidden property) is not
 * reported yet, because Hidden values are left out of the report. A source
 * value that a Hidden property replaced is reported as dropped instead.
 */

/** A step of the migration plan, in application order. */

function templateRef(template) {
  return {
    id: template.id,
    version: template.version ?? 0,
    name: template.name,
    deprecated: Boolean(template.deprecated)
  };
}
const sameField = (a, b) => a.key === b.key && a.bindingType === b.bindingType;
export function mergeFacts(all) {
  let moved = [];
  let set = [];
  let failedWrites = false;
  let snapshot;
  for (const facts of all) {

    // All moves read the pre-step snapshot, never another move's result.
    const priorMoved = moved;
    const priorSet = set;
    const overwritten = field => facts.moved.some(move => sameField(move.to, field)) || facts.set.some(write => sameField(write, field));
    const forwarded = field => facts.moved.some(move => sameField(move.from, field));
    failedWrites ||= priorMoved.some(move => overwritten(move.to) && !forwarded(move.to));
    moved = priorMoved.filter(move => !overwritten(move.to) && !forwarded(move.to));
    set = priorSet.filter(write => !overwritten(write) && !forwarded(write));
    for (const move of facts.moved) {
      const addition = priorSet.find(write => sameField(write, move.from));
      if (addition) {
        set.push({
          ...move.to,
          value: move.value ?? addition.value
        });
      } else {
        const prior = priorMoved.find(item => sameField(item.to, move.from));
        const read = prior ? prior.read : snapshot && find(snapshot, move.from.key, move.from.bindingType)?.value;
        moved.push({
          ...move,
          from: prior?.from ?? move.from,
          transformed: Boolean(prior?.transformed) || move.transformed,
          ...(read === undefined ? {} : {
            read
          })
        });
      }
    }
    for (const write of facts.set) {
      moved = moved.filter(move => !sameField(move.to, write));
      set = set.filter(prior => !sameField(prior, write));
      set.push(write);
    }
    if (facts.after) {
      const after = facts.after;

      // A later step may store the value FEEL-wrapped, which keeps it.
      const surviving = (field, value) => {
        const actual = find(after, field.key, field.bindingType);

        // A Hidden reset is a replacement, not FEEL normalization.
        const replaced = (facts.reset ?? []).some(r => sameField(r, field) && r.from === value);
        return actual !== undefined && (value === undefined || actual.value === value || actual.value === `=${value}` && !replaced);
      };
      const stored = (field, value) => value === undefined ? value : find(after, field.key, field.bindingType)?.value ?? value;
      failedWrites ||= moved.some(move => !surviving(move.to, move.value)) || set.some(write => !surviving(write, write.value));
      moved = moved.filter(move => surviving(move.to, move.value)).map(move => ({
        ...move,
        value: stored(move.to, move.value)
      }));
      set = set.filter(write => surviving(write, write.value)).map(write => ({
        ...write,
        value: stored(write, write.value) ?? write.value
      }));
      snapshot = after;
    }
    failedWrites ||= Boolean(facts.failedWrites);
  }
  return {
    moved,
    set,
    failedWrites,
    written: all.flatMap(f => [ ...(f.written ?? []), ...f.moved.map(move => move.to), ...f.set.map(({
      key,
      bindingType
    }) => ({
      key,
      bindingType
    })) ]),
    reset: all.flatMap(f => f.reset ?? []),
    notes: all.flatMap(f => f.notes),
    guardSkipped: all.flatMap(f => f.guardSkipped),
    templateSkipped: all.flatMap(f => f.templateSkipped),
    noMatch: all.flatMap(f => f.noMatch),
    feelSkipped: all.flatMap(f => f.feelSkipped)
  };
}
function propertyFor(template, key, bindingType) {
  return findPropertiesByTarget(template?.properties ?? [], key, bindingType)[0];
}
function fieldOf(template, key, bindingType) {
  const property = propertyFor(template, key, bindingType);
  const field = {
    key,
    bindingType: bindingType ?? property?.binding?.type ?? null
  };
  if (property?.label) {
    field.label = property.label;
  }
  if (property?.group) {
    field.group = property.group;
    const groupLabel = template?.groups?.find(g => g.id === property.group)?.label;
    if (groupLabel) {
      field.groupLabel = groupLabel;
    }
  }
  if (property?.id) {
    field.propertyId = property.id;
  }
  return field;
}

/**
 * Sort `items` like the Modeler properties panel: by group order, then by
 * property order of `template`. Ungrouped and unknown fields go last.
 */
function inTemplateOrder(template, items, fieldKey) {
  const groups = template?.groups ?? [];
  const properties = template?.properties ?? [];
  const position = item => {
    const {
      key,
      bindingType
    } = fieldKey(item);
    const property = propertyFor(template, key, bindingType);
    const group = groups.findIndex(g => g.id === property?.group);
    return [ group === -1 ? groups.length : group, property ? properties.indexOf(property) : properties.length ];
  };
  return items.map(item => ({
    item,
    position: position(item)
  })).sort((a, b) => a.position[0] - b.position[0] || a.position[1] - b.position[1]).map(({
    item
  }) => item);
}
function choiceName(template, field, value) {
  const property = propertyFor(template, field.key, field.bindingType);
  return property?.choices?.find(c => c.value === value)?.name;
}
function find(values, key, bindingType) {
  return values.find(v => sameTarget(v, {
    key,
    bindingType
  }));
}
function isHidden(template, key, bindingType) {
  return propertyFor(template, key, bindingType)?.type === 'Hidden';
}

/**
 * Hidden status across conditional duplicates, without evaluating their
 * conditions. `some` and `every` both lean toward reporting a loss.
 */
export function hiddenIn(template, v, match) {
  const properties = findPropertiesByTarget(template.properties, v.key, v.bindingType);
  return properties.length > 0 && properties[match](property => property.type === 'Hidden');
}
function withNames(template, field, value) {
  const name = choiceName(template, field, value);
  return name ? {
    valueName: name
  } : {};
}
export function buildReport({
  fromTemplate,
  toTemplate,
  via = [ toTemplate ],
  before,
  after,
  facts,
  usedRecipe,
  refusal,
  steps = [],
  lostInImplicitSteps = [],
  implicitTemplates = []
}) {
  const survivingMoves = facts.moved.filter(m => {
    const source = find(before, m.from.key, m.from.bindingType);
    const target = find(after, m.to.key, m.to.bindingType);
    return source !== undefined && target !== undefined && (m.value !== undefined ? target.value === m.value : m.transformed ? source.value === '' || target.value !== '' : target.value === source.value);
  });
  const survivingSets = facts.set.filter(s => find(after, s.key, s.bindingType)?.value === s.value);

  // A set over a prior value is reported as changed or kept, not added.
  const addedSets = survivingSets.filter(s => !find(before, s.key, s.bindingType));

  // Maps read the original values; recipe moves read the post-step snapshot.
  const claimedByMap = v => survivingMoves.some(m => m.map && sameTarget(v, m.from));

  // A move claims its source only when it read the original value. An earlier
  // step may have reset the source, e.g. to a Hidden default.
  const claimedFrom = v => survivingMoves.some(m => sameTarget(v, m.from) && (m.read === undefined || m.read === v.value));
  const claimedTo = v => survivingMoves.some(m => sameTarget(v, m.to)) || addedSets.some(s => sameTarget(v, s));
  const moved = survivingMoves.map(m => {
    const from = fieldOf(fromTemplate, m.from.key, m.from.bindingType);
    const to = fieldOf(toTemplate, m.to.key, m.to.bindingType);
    const fromValue = find(before, m.from.key, m.from.bindingType)?.value;

    // Surviving moves always have a target value.
    const toValue = find(after, m.to.key, m.to.bindingType)?.value ?? '';
    const item = {
      from,
      to,
      value: toValue,
      ...withNames(toTemplate, to, toValue),
      source: m.map ? 'map' : 'recipe'
    };
    if ((m.transformed || fromValue !== toValue) && fromValue !== undefined) {
      item.valueChange = {
        from: fromValue,
        to: toValue,
        ...nameOf('fromName', choiceName(fromTemplate, from, fromValue)),
        ...nameOf('toName', choiceName(toTemplate, to, toValue))
      };
    }
    return item;
  });

  // A move whose destination the Modeler removed (an inactive conditional
  // binding) lost its value even when another move still claims the source.
  const lostBySource = v => facts.moved.some(m => !survivingMoves.includes(m) && sameTarget(v, m.from) && find(after, m.to.key, m.to.bindingType) === undefined);

  // A populated value still bound after the migration can be lost too: a
  // Hidden target property resets it, or a move or set writes over it in
  // any step.
  const written = [ ...(facts.written ?? []), ...facts.moved.map(m => m.to), ...facts.set ];
  const causeOf = v => {
    const actual = find(after, v.key, v.bindingType);
    if (!actual || actual.value === v.value || claimedFrom(v)) return;
    if (written.some(w => sameTarget(v, w))) return 'displaced';

    // An intermediate step may reset the value even when the final
    // template binds it as editable again.
    const reset = hiddenIn(toTemplate, v, 'some') || (facts.reset ?? []).some(r => sameTarget(v, r) && r.from === v.value);
    if (reset && !hiddenIn(fromTemplate, v, 'every')) return 'hidden';
  };
  const droppedValues = before.filter(v => v.value !== '' && (causeOf(v) || !claimedFrom(v) && !find(after, v.key, v.bindingType) || lostBySource(v)));
  const dropped = [ ...droppedValues, ...lostInImplicitSteps.filter(v => !find(droppedValues, v.key, v.bindingType) &&

  // A surviving map that carries the original value on is not a loss.
  !(claimedByMap(v) && find(before, v.key, v.bindingType)?.value === v.value)) ].map(v => {
    const cause = causeOf(v);
    const field = fieldOf(fromTemplate, v.key, v.bindingType);
    return {
      ...field,
      value: v.value,
      ...withNames(fromTemplate, field, v.value),
      ...(cause ? {
        cause
      } : {})
    };
  });
  const added = after.filter(v => v.value !== '' && !find(before, v.key, v.bindingType) && !isHidden(toTemplate, v.key, v.bindingType) && !claimedTo(v)).map(v => {
    const field = fieldOf(toTemplate, v.key, v.bindingType);
    return {
      ...field,
      value: v.value,
      ...withNames(toTemplate, field, v.value),
      source: 'default'
    };
  });
  for (const s of addedSets) {
    const field = fieldOf(toTemplate, s.key, s.bindingType);
    const actual = find(after, s.key, s.bindingType)?.value ?? '';
    added.push({
      ...field,
      value: actual,
      ...withNames(toTemplate, field, actual),
      source: 'recipe'
    });
  }
  const changed = after.filter(v => {
    const prior = find(before, v.key, v.bindingType);
    return prior !== undefined && prior.value !== v.value && !claimedTo(v) && !isHidden(toTemplate, v.key, v.bindingType);
  }).map(v => {
    const prior = find(before, v.key, v.bindingType);
    const field = fieldOf(toTemplate, v.key, v.bindingType);
    const fromValue = prior?.value ?? '';
    return {
      ...field,
      valueChange: {
        from: fromValue,
        to: v.value,
        ...nameOf('fromName', choiceName(fromTemplate, field, fromValue)),
        ...nameOf('toName', choiceName(toTemplate, field, v.value))
      },
      source: survivingSets.some(s => sameTarget(v, s)) ? 'recipe' : 'default'
    };
  });
  const kept = after.filter(v => v.value !== '' && find(before, v.key, v.bindingType)?.value === v.value && !claimedTo(v) && !isHidden(toTemplate, v.key, v.bindingType)).map(v => fieldOf(toTemplate, v.key, v.bindingType));
  const skipped = {
    guard: facts.guardSkipped,
    template: facts.templateSkipped,
    noMatch: facts.noMatch,
    feel: facts.feelSkipped,
    unchecked: [ ...via, ...implicitTemplates ].flatMap(template => uncheckedFields(fromTemplate, [ template ])).filter((f, i, all) => all.findIndex(g => g.key === f.key && g.bindingType === f.bindingType) === i)
  };
  return {
    from: templateRef(fromTemplate),
    to: templateRef(toTemplate),
    usedRecipe,
    refusal,
    steps,
    dropped: inTemplateOrder(fromTemplate, dropped, item => item),
    added: inTemplateOrder(toTemplate, added, item => item),
    changed: inTemplateOrder(toTemplate, changed, item => item),
    moved: inTemplateOrder(toTemplate, moved, item => item.to),
    kept: inTemplateOrder(toTemplate, kept, item => item),
    notes: facts.notes,
    skipped,
    lossless: !facts.failedWrites && survivingMoves.length === facts.moved.filter(move => find(before, move.from.key, move.from.bindingType)).length && survivingSets.length === facts.set.length && dropped.length === 0 && skipped.guard.length === 0 && skipped.template.length === 0 && skipped.noMatch.length === 0 && skipped.unchecked.length === 0
  };
}

/**
 * Editable source fields under a binding type the engine does not read. The
 * Modeler keeps such a value only when every applied template binds it
 * identically and not as Hidden, so any other case may lose a value the
 * report cannot see.
 */
function uncheckedFields(fromTemplate, via) {
  return fromTemplate.properties.filter(p => p.binding && p.type !== 'Hidden' && bindingTargetKey(p.binding) === undefined && via.some(template => !template.properties.some(t => t.type !== 'Hidden' && sameBinding(t.binding, p.binding)))).map(p => {
    const binding = {
      ...p.binding
    };
    const field = {
      key: String(binding.name ?? binding.property ?? p.id ?? ''),
      bindingType: p.binding?.type ?? null
    };
    if (p.label) field.label = p.label;
    if (p.id) field.propertyId = p.id;
    return field;
  });
}
function sameBinding(a, b) {
  if (!a || !b) return false;
  const x = {
    ...a
  };
  const y = {
    ...b
  };
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every(k => x[k] === y[k]);
}
function nameOf(field, name) {
  return name === undefined ? {} : {
    [field]: name
  };
}
