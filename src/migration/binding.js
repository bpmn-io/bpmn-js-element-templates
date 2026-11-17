// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Binding lookup: which moddle child and property a template binding reads
 * or writes, and which key identifies a binding.
 *
 * Hand-rolled because `bpmn-js-element-templates` exports no property-write
 * utility. Covers the Zeebe binding types connector templates use.
 *
 * This is a superset of the plugin-level `../binding.ts`. Do not merge them:
 * `migration/` MUST NOT import from outside itself.
 */

import { getModdleList } from './moddle.js';

/** Binding-type prefixes a recipe path may use, mapped to the full type. */
const BINDING_TYPE_PREFIXES = {
  input: 'zeebe:input',
  output: 'zeebe:output',
  header: 'zeebe:taskHeader',
  property: 'zeebe:property',
  taskDefinition: 'zeebe:taskDefinition',
  agentDefinition: 'zeebe:agentDefinition',
  adHoc: 'zeebe:adHoc'
};

/** Split an optional binding-type prefix off a recipe path. */
export function splitBindingPrefix(path) {
  const colon = path.indexOf(':');
  if (colon !== -1) {
    const bindingType = BINDING_TYPE_PREFIXES[path.slice(0, colon)];
    if (bindingType) {
      return {
        bindingType,
        key: path.slice(colon + 1)
      };
    }
  }
  return {
    bindingType: null,
    key: path
  };
}

/** Qualify a key with its binding-type prefix, as a recipe path. */
export function bindingPath(bindingType, key) {
  const prefix = bindingType === 'zeebe:taskHeader' ? 'header' : bindingType?.replace('zeebe:', '');
  return `${prefix}:${key}`;
}
function findExtensionByType(extensionElements, type) {
  const matches = getModdleList(extensionElements, 'values').filter(v => v.$type === type);
  if (matches.length > 1) throw new Error(`Duplicate backing container ${type}; remove duplicate extension containers before migrating.`);
  return matches[0];
}
export function findExtensionContainers(extensionElements) {
  const containers = {
    ioMapping: findExtensionByType(extensionElements, 'zeebe:IoMapping'),
    taskHeaders: findExtensionByType(extensionElements, 'zeebe:TaskHeaders'),
    taskDefinition: findExtensionByType(extensionElements, 'zeebe:TaskDefinition'),
    zeebeProperties: findExtensionByType(extensionElements, 'zeebe:Properties'),
    agentDefinition: findExtensionByType(extensionElements, 'zeebe:AgentDefinition'),
    adHoc: findExtensionByType(extensionElements, 'zeebe:AdHoc')
  };

  // Check identities before reading values: missing values still occupy a path.
  for (const [ container, list, key, prefix ] of [ [ containers.ioMapping, 'inputParameters', 'target', 'input' ], [ containers.ioMapping, 'outputParameters', 'source', 'output' ], [ containers.taskHeaders, 'values', 'key', 'header' ], [ containers.zeebeProperties, 'properties', 'name', 'property' ] ]) {
    const seen = new Set();
    for (const child of getModdleList(container, list)) {
      const identity = child.get(key);
      if (typeof identity !== 'string') continue;
      if (seen.has(identity)) throw new Error(`Duplicate source backing path ${prefix}:${identity}; remove duplicate backing entries before migrating.`);
      seen.add(identity);
    }
  }
  return containers;
}

/**
 * The existing moddle child and property a binding writes to, or `undefined`
 * when the backing entry does not exist (yet).
 */
export function resolveBindingTarget(binding, containers) {
  switch (binding.type) {
  case 'zeebe:input':
  {
    const inputs = getModdleList(containers.ioMapping, 'inputParameters');
    const child = inputs.find(p => p.target === binding.name);
    return child ? {
      child,
      property: 'source'
    } : undefined;
  }
  case 'zeebe:output':
  {
    const outputs = getModdleList(containers.ioMapping, 'outputParameters');
    const child = outputs.find(p => p.source === binding.source);
    return child ? {
      child,
      property: 'target'
    } : undefined;
  }
  case 'zeebe:taskHeader':
  {
    const headers = getModdleList(containers.taskHeaders, 'values');
    const child = headers.find(h => h.key === binding.key);
    return child ? {
      child,
      property: 'value'
    } : undefined;
  }
  case 'zeebe:property':
  {
    const props = getModdleList(containers.zeebeProperties, 'properties');
    const child = props.find(p => p.name === binding.name);
    return child ? {
      child,
      property: 'value'
    } : undefined;
  }
  case 'zeebe:taskDefinition':
    return containers.taskDefinition && binding.property ? {
      child: containers.taskDefinition,
      property: binding.property
    } : undefined;
  case 'zeebe:agentDefinition':
    return containers.agentDefinition && binding.property ? {
      child: containers.agentDefinition,
      property: binding.property
    } : undefined;
  case 'zeebe:adHoc':
    return containers.adHoc && binding.property ? {
      child: containers.adHoc,
      property: binding.property
    } : undefined;
  default:
    return undefined;
  }
}

/** The key that identifies where a binding writes, per binding type. */
export function bindingTargetKey(binding) {
  if (!binding) {
    return undefined;
  }
  switch (binding.type) {
  case 'zeebe:input':
  case 'zeebe:property':
    return binding.name;
  case 'zeebe:output':
    return binding.source;
  case 'zeebe:taskHeader':
    return binding.key;
  case 'zeebe:taskDefinition':
  case 'zeebe:agentDefinition':
  case 'zeebe:adHoc':
    return binding.property;
  default:
    return undefined;
  }
}

/** A binding target: a key and, when known, the binding type it lives under. */

/** Whether `candidate` is `target`; a null target binding type matches any. */
export function sameTarget(candidate, target) {
  return candidate.key === target.key && (target.bindingType === null || candidate.bindingType === target.bindingType);
}

/** Template properties bound to `key`, optionally restricted to a binding type. */
export function findPropertiesByTarget(properties, key, bindingType) {
  return properties.filter(p => sameTarget({
    key: bindingTargetKey(p.binding),
    bindingType: p.binding?.type
  }, {
    key,
    bindingType
  }));
}

/**
 * A `feel: required` property always stores a FEEL expression. Prepend `=`
 * to a written value that lacks it, as the Modeler does.
 */
export function maybePrependFeel(property, value) {
  if (property.feel !== 'required') {
    return value;
  }
  if (value === '' || value.startsWith('=')) {
    return value;
  }
  return `=${value}`;
}
