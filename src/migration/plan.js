// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Resolves one recipe source against an element's current values: which
 * values to write on the target template and what happened along the way.
 *
 * Pure: reads a snapshot of the element's values and never sees another
 * entry's write, so the result does not depend on entry order.
 */

import { bindingPath, bindingTargetKey, findPropertiesByTarget, maybePrependFeel, sameTarget, splitBindingPrefix } from './binding.js';

/** A value moved to another key, possibly translated on the way. */

export const TEMPLATE_REF = /\$\{([^}]+)\}/g;

/** Compile a `*`-only glob to an anchored regex; `*` also spans newlines. */
export function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 's');
}
function lookup(values, path) {
  const {
    bindingType,
    key
  } = splitBindingPrefix(path);
  const matches = values.filter(v => sameTarget(v, {
    key,
    bindingType
  }));
  if (matches.length > 1) {
    const types = new Set(matches.map(v => v.bindingType));
    const qualified = [ ...types ].map(type => bindingPath(type, key));
    throw new Error(`${types.size > 1 ? 'Ambiguous' : 'Duplicate'} source path "${path}"; use ${qualified.join(', ')}${types.size === 1 ? ' after removing duplicate backing entries' : ''}`);
  }
  return matches[0];
}
function evalGuard(guard, values) {
  const value = lookup(values, guard.path)?.value;
  if (guard.kind === 'exists') {
    return guard.exists ? value !== undefined : value === undefined;
  }
  let result;
  if (guard.kind === 'equals') {
    result = value === guard.value;
  } else if (guard.kind === 'matches') {
    result = value !== undefined && globToRegex(guard.pattern).test(value);
  } else {
    result = value !== undefined && guard.values.includes(value);
  }
  return guard.not ? !result : result;
}
function isPopulated(value) {
  return value !== undefined && value !== '';
}
function effectiveFeel(property) {
  return property.feel ?? ([ 'zeebe:input', 'zeebe:output' ].includes(property.binding?.type ?? '') ? 'static' : undefined);
}

/** Mirror the Modeler's FEEL storage for typed input/output parameters. */
export function normalizeDestinationValue(property, value) {
  const feel = effectiveFeel(property);
  if (value.startsWith('=')) return value;
  if (feel === 'required' || [ 'optional', 'static' ].includes(feel ?? '') && [ 'Number', 'Boolean' ].includes(property.type ?? '')) {
    return `=${property.type === 'Boolean' ? value !== 'false' && value !== '' : value}`;
  }
  return value;
}
export const CARRY_OVER_LABEL = 'carry-over';

/**
 * Populated source values that no recipe write covers and that a non-Hidden
 * target property binds. Checked against `writes` only.
 */
export function carryOverWrites(writes, sourceValues, template) {
  return sourceValues.filter(source => isPopulated(source.value) && !writes.some(w => w.key === source.key && w.bindingType === source.bindingType) && findPropertiesByTarget(template.properties, source.key, source.bindingType).some(p => p.type !== 'Hidden')).map(source => ({
    key: source.key,
    bindingType: source.bindingType,
    value: source.value,
    entry: {
      kind: 'set',
      to: source.key,
      value: source.value,
      when: [],
      label: CARRY_OVER_LABEL
    }
  }));
}

/** A resolved write does not satisfy its destination property. */
export class DestinationError extends Error {

  /** The value was carried over by key, not written by a recipe or map entry. */
  carryOver;
  constructor(message, carryOver) {
    super(message);
    this.carryOver = carryOver;
  }
}
class ConditionError extends Error {
  kind;
  constructor(kind) {
    super(`${kind} destination property condition`);
    this.kind = kind;
  }
}

/** Validate recipe writes and the populated, non-Hidden values apply carries over. */
export function validateDestinationValues(writes, sourceValues, template) {
  const activeProperties = new Set();
  const resolvedValue = property => {
    const key = bindingTargetKey(property.binding);
    const write = writes.find(w => w.key === key && w.bindingType === property.binding?.type);
    if (write && !(write.entry.label === CARRY_OVER_LABEL && property.type === 'Hidden')) return normalizeDestinationValue(property, write.value);
    if (property.type !== 'Hidden' && key !== undefined) {
      const source = lookup(sourceValues, bindingPath(property.binding?.type, key));
      if (source && isPopulated(source.value)) return normalizeDestinationValue(property, source.value);
    }
    return property.value;
  };
  const isActive = (property, visiting = new Set()) => {
    if (!('condition' in property) || !property.condition) return true;
    if (visiting.has(property)) throw new ConditionError('cyclic');
    const next = new Set(visiting).add(property);
    const evaluate = condition => {
      if (typeof condition !== 'object' || condition === null) throw new ConditionError('unsupported');
      if ('allMatch' in condition && Array.isArray(condition.allMatch)) return condition.allMatch.every(evaluate);
      if (!('property' in condition) || typeof condition.property !== 'string') throw new ConditionError('unsupported');
      const related = template.properties.find(p => p.id === condition.property);
      if ('isActive' in condition && typeof condition.isActive === 'boolean') return condition.isActive ? !!related && isActive(related, next) : !related || !isActive(related, next);
      if (!('equals' in condition) && !('oneOf' in condition && Array.isArray(condition.oneOf)) && !('isEmpty' in condition && typeof condition.isEmpty === 'boolean')) throw new ConditionError('unsupported');
      if (!related) return false;
      const value = resolvedValue(related);
      if ('isEmpty' in condition) return condition.isEmpty === (value === undefined || value === null || value === '');
      const compare = expected => {
        if (value === undefined || value === null) return false;
        const literal = v => typeof v === 'string' && v.startsWith('=') ? v.slice(1) : v;
        if (related.type === 'Number') return Number(literal(value)) === Number(literal(expected));
        if (related.type === 'Boolean') return String(literal(value)) !== 'false' === (typeof expected === 'string' && expected.startsWith('=') ? literal(expected) !== 'false' : expected);
        return (related.feel === 'required' ? literal(value) : value) === literal(expected);
      };
      return 'equals' in condition ? compare(condition.equals) : 'oneOf' in condition && Array.isArray(condition.oneOf) && condition.oneOf.some(compare);
    };
    return evaluate(property.condition);
  };
  const candidates = [ ...writes, ...carryOverWrites(writes, sourceValues, template) ];
  for (const write of candidates) {
    const path = bindingPath(write.bindingType, write.key);
    const at = `${write.entry.label}: destination "${path}"`;
    const fail = problem => new DestinationError(`${at} ${problem}`, write.entry.label === CARRY_OVER_LABEL);
    for (const property of findPropertiesByTarget(template.properties, write.key, write.bindingType)) {
      if (write.entry.label === CARRY_OVER_LABEL && property.type === 'Hidden') continue;
      let active;
      try {
        active = isActive(property);
      } catch (error) {
        if (!(error instanceof ConditionError)) throw error;
        throw fail(`has ${error.kind} condition`);
      }
      if (!active) continue;
      activeProperties.add(property);
      const constraints = property.constraints;
      for (const constraint of Object.keys(constraints ?? {})) {
        if (constraint !== 'notEmpty' && constraint !== 'pattern') throw fail(`has unsupported constraint ${constraint}`);
      }

      // Validate what the Modeler stores, e.g. `=true` for the Boolean "yes".
      const stored = maybePrependFeel(property, effectiveFeel(property) === 'static' && [ 'Number', 'Boolean' ].includes(property.type ?? '') ? normalizeDestinationValue(property, write.value) : write.value);
      const isExpression = stored.startsWith('=') && (property.feel === 'optional' || property.feel === 'required');

      // Static Number and Boolean values are stored as `=<literal>`.
      const literal = effectiveFeel(property) === 'static' && [ 'Number', 'Boolean' ].includes(property.type ?? '') && stored.startsWith('=') ? stored.slice(1) : stored;
      if (constraints?.notEmpty && (isExpression ? stored.slice(1) : literal).trim() === '') throw fail('violates notEmpty constraint');
      if (isExpression) continue;
      if (property.choices && !property.choices.some(choice => choice.value === literal)) throw fail('violates choice constraint');
      if (constraints?.pattern) {
        let pattern;
        try {
          pattern = new RegExp(constraints.pattern.value);
        } catch {
          throw fail('has invalid pattern constraint');
        }
        if (!pattern.test(literal)) throw fail('violates pattern constraint');
      }
    }
  }
  return activeProperties;
}
export function emptyFacts() {
  return {
    moved: [],
    set: [],
    notes: [],
    guardSkipped: [],
    templateSkipped: [],
    noMatch: [],
    feelSkipped: []
  };
}
export function buildStepPlan(entries, sourceValues, template, /** True when absent reads cannot be told apart from a misspelled path. */
    unverifiedReads = false) {
  const facts = emptyFacts();
  const writes = [];
  const write = (entry, to, value) => {
    const target = splitBindingPrefix(to);
    if (template) {
      validateTargets([ entry ], template);
      const properties = findPropertiesByTarget(template.properties, target.key, target.bindingType);
      target.bindingType = properties[0].binding?.type ?? null;
    }
    writes.push({
      key: target.key,
      bindingType: target.bindingType,
      value,
      entry
    });
    if (entry.note) {
      facts.notes.push(entry.note);
    }
    return target;
  };
  for (const entry of entries) {
    if (unverifiedReads) {
      for (const guard of entry.when) {
        if (!lookup(sourceValues, guard.path)) {
          facts.noMatch.push({
            from: guard.path,
            to: entry.to
          });
        }
      }
    }
    const active = entry.when.every(g => evalGuard(g, sourceValues));
    if (entry.kind === 'set') {
      if (active) {
        const target = write(entry, entry.to, entry.value);
        facts.set.push({
          key: target.key,
          bindingType: target.bindingType,
          value: entry.value
        });
      }
      continue;
    }
    if (entry.kind === 'template') {
      const refs = [ ...entry.template.matchAll(TEMPLATE_REF) ].map(m => m[1]);
      const resolved = refs.map(ref => lookup(sourceValues, ref)?.value);
      if (!active) {
        if (resolved.some(isPopulated)) {
          facts.guardSkipped.push({
            from: entry.template,
            to: entry.to
          });
        }
        continue;
      }
      const missing = refs.filter((_, i) => !isPopulated(resolved[i]));
      if (missing.length > 0) {
        facts.templateSkipped.push({
          to: entry.to,
          missing
        });
        continue;
      }
      let i = 0;
      write(entry, entry.to, entry.template.replace(TEMPLATE_REF, () => resolved[i++] ?? ''));
      continue;
    }
    const source = lookup(sourceValues, entry.from);
    if (!active) {
      if (source && isPopulated(source.value)) {
        facts.guardSkipped.push({
          from: entry.from,
          to: entry.to
        });
      }
      continue;
    }
    if (!source) {
      if (unverifiedReads) {
        facts.noMatch.push({
          from: entry.from,
          to: entry.to
        });
      }
      continue;
    }
    let value = source.value;
    let transformed = false;
    if (entry.valueMap) {
      if (source.isFeel) {
        facts.feelSkipped.push({
          from: entry.from,
          to: entry.to
        });
      } else {
        const rule = entry.valueMap.rules.find(r => globToRegex(r.match).test(source.value));
        const mapped = rule?.value ?? entry.valueMap.default;
        if (mapped === undefined) {
          facts.noMatch.push({
            from: entry.from,
            to: entry.to
          });
          continue;
        }
        value = mapped;
        transformed = value !== source.value;
      }
    }
    const target = write(entry, entry.to, value);
    facts.moved.push({
      from: {
        key: source.key,
        bindingType: source.bindingType
      },
      to: {
        key: target.key,
        bindingType: target.bindingType
      },
      transformed
    });
  }

  // A source that an active entry moved is not lost to a guarded alternative.
  facts.guardSkipped = facts.guardSkipped.filter(skip => !facts.moved.some(move => sameTarget(move.from, splitBindingPrefix(skip.from))));
  assertNoAmbiguousWrites(writes);
  const activeProperties = template ? validateDestinationValues(writes, sourceValues, template) : new Set();
  return {
    writes,
    facts,
    activeProperties
  };
}

/** Two active writes to the same target make the recipe ambiguous. */
export function assertNoAmbiguousWrites(writes) {
  const seen = new Map();
  for (const w of writes) {
    const id = `${w.bindingType ?? ''} ${w.key}`;
    const previous = seen.get(id);
    if (previous) {
      throw new Error(`Ambiguous migration: ${previous.entry.label} and ${w.entry.label} both write to "${w.key}"`);
    }
    seen.set(id, w);
  }
}

/**
 * Fails when an entry writes to a path the target template does not bind,
 * binds only as Hidden with a fixed value, or binds under several binding
 * types without a prefix.
 */
export function validateTargets(entries, template) {
  const label = `${template.id}${template.version === undefined ? '' : `@${template.version}`}`;
  for (const entry of entries) {
    const {
      bindingType,
      key
    } = splitBindingPrefix(entry.to);
    const matches = findPropertiesByTarget(template.properties, key, bindingType);
    if (matches.length === 0) {
      throw new Error(`${entry.label}: target path "${entry.to}" is not a binding in template ${label}`);
    }
    if (matches.every(m => m.type === 'Hidden' && m.value !== undefined)) {
      throw new Error(`${entry.label}: target path "${entry.to}" is a Hidden property with a fixed value in template ${label}`);
    }
    const types = new Set(matches.map(m => m.binding?.type));
    if (types.size > 1) {
      throw new Error(`${entry.label}: target path "${entry.to}" is bound by several binding types in template ${label}; add a prefix such as input: or header:`);
    }
  }
}
