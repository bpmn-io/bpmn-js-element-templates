import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { is, isAny } from 'bpmn-js/lib/util/ModelUtil';

import {
  filter,
  flatten,
  has,
  isNil,
  isObject,
  isString,
  isUndefined,
  reduce,
  values
} from 'min-dash';

import {
  valid as isSemverValid,
  satisfies as isSemverCompatible,
  coerce
} from 'semver';

/**
 * The BPMN 2.0 extension attribute name under
 * which the element template ID is stored.
 *
 * @type {String}
 */
export const TEMPLATE_ID_ATTR = 'camunda:modelerTemplate';

/**
 * The BPMN 2.0 extension attribute name under
 * which the element template version is stored.
 *
 * @type {String}
 */
export const TEMPLATE_VERSION_ATTR = 'camunda:modelerTemplateVersion';

/**
 * Coerces and validates engine profile.
 *
 * @param {Object} engines
 * @param {string} [elementTemplatesVersion]
 *
 * @return {Object}
 */
export function coerceEngines(engines, packageVersion) {

  engines = {
    elementTemplates: packageVersion,
    ...engines
  };

  return reduce(engines, (validEngines, version, engine) => {

    const coercedVersion = coerce(version);

    if (!isSemverValid(coercedVersion)) {
      console.error(
        new Error(`Engine <${ engine }> specifies unparseable version <${version}>`)
      );

      return validEngines;
    }

    return {
      ...validEngines,
      [ engine ]: coercedVersion.raw
    };
  }, {});
}

/**
 * Returns incompatible engines for a given template.
 *
 * @param {Object} template
 * @param {Object} checkEngines
 *
 * @return {Object}
 */
export function getIncompatibleEngines(template, checkEngines) {
  const templateEngines = template.engines;

  return reduce(templateEngines, (result, _, engine) => {

    if (!has(checkEngines, engine)) {
      return result;
    }

    if (!isSemverCompatible(checkEngines[engine], templateEngines[engine])) {
      result[engine] = {
        actual: checkEngines[engine],
        required: templateEngines[engine]
      };
    }

    return result;
  }, {});
}

/**
 * Returns whether a template is compatible with the given engines.
 *
 * @param {Object} template
 * @param {Object} checkEngines
 *
 * @return {boolean}
 */
export function isCompatible(template, checkEngines) {
  return !Object.keys(getIncompatibleEngines(template, checkEngines)).length;
}

/**
 * Build a map of templates grouped by ID.
 *
 * @param {Array<Object>} templates
 * @param {Object} engines
 *
 * @return {Object}
 */
export function buildTemplatesById(templates, engines) {
  const templatesById = {};

  templates.forEach((template) => {
    const id = template.id;
    const version = isUndefined(template.version) ? '_' : template.version;

    if (!templatesById[ id ]) {
      templatesById[ id ] = { };
    }

    templatesById[ id ][ version ] = template;

    const latest = templatesById[ id ].latest;

    if (isCompatible(template, engines)) {
      if (!latest || isUndefined(latest.version) || template.version > latest.version) {
        templatesById[ id ].latest = template;
      }
    }
  });

  return templatesById;
}

/**
 * Find templates in a list of templates.
 *
 * @param {string|djs.model.Base} [id]
 * @param {Object} templatesIndex
 * @param {Object} [options]
 * @param {boolean} [options.latest]
 * @param {boolean} [options.deprecated]
 *
 * @return {Array<Object>}
 */
export function findTemplates(id, templatesIndex, options = {}) {
  const {
    latest: includeLatestOnly,
    deprecated: includeDeprecated
  } = options;

  const getVersions = (template) => {
    const { latest, ...versions } = template;
    return includeLatestOnly ? (
      !includeDeprecated && (latest && latest.deprecated) ? [] : (latest ? [ latest ] : [])
    ) : values(versions) ;
  };

  if (isNil(id)) {
    return flatten(values(templatesIndex).map(getVersions));
  }

  if (isObject(id)) {
    const element = id;

    return filter(findTemplates(null, templatesIndex, options), function(template) {
      return isAny(element, template.appliesTo);
    }) || [];
  }

  if (isString(id)) {
    return templatesIndex[ id ] && getVersions(templatesIndex[ id ]);
  }

  throw new Error('argument must be of type {string|djs.model.Base|undefined}');
}


/**
 * Get template id for a given diagram element.
 *
 * @param {djs.model.Base} element
 *
 * @return {String}
 */
export function getTemplateId(element) {
  const businessObject = getBusinessObject(element);

  if (businessObject) {
    return businessObject.get(TEMPLATE_ID_ATTR);
  }
}

/**
 * Get template version for a given diagram element.
 *
 * @param {djs.model.Base} element
 *
 * @return {String}
 */
export function getTemplateVersion(element) {
  const businessObject = getBusinessObject(element);

  if (businessObject) {
    return businessObject.get(TEMPLATE_VERSION_ATTR);
  }
}

/**
 * Find extension with given type in
 * BPMN element, diagram element or ExtensionElement.
 *
 * @param {ModdleElement|djs.model.Base} element
 * @param {String} type
 *
 * @return {ModdleElement} the extension
 */
export function findExtension(element, type) {
  const businessObject = getBusinessObject(element);

  let extensionElements;

  if (is(businessObject, 'bpmn:ExtensionElements')) {
    extensionElements = businessObject;
  } else {
    extensionElements = businessObject.get('extensionElements');
  }

  if (!extensionElements) {
    return null;
  }

  return extensionElements.get('values').find((value) => {
    return is(value, type);
  });
}

export function findExtensions(element, types) {
  const extensionElements = getExtensionElements(element);

  if (!extensionElements) {
    return [];
  }

  return extensionElements.get('values').filter((value) => {
    return isAny(value, types);
  });
}

export function findCamundaInOut(element, binding) {
  const extensionElements = getExtensionElements(element);

  if (!extensionElements) {
    return;
  }

  const { type } = binding;

  let matcher;

  if (type === 'camunda:in') {
    matcher = (element) => {
      return is(element, 'camunda:In') && isInOut(element, binding);
    };
  } else if (type === 'camunda:out') {
    matcher = (element) => {
      return is(element, 'camunda:Out') && isInOut(element, binding);
    };
  } else if (type === 'camunda:in:businessKey') {
    matcher = (element) => {
      return is(element, 'camunda:In') && 'businessKey' in element;
    };
  }

  return extensionElements.get('values').find(matcher);
}

export function findCamundaProperty(camundaProperties, binding) {
  return camundaProperties.get('values').find((value) => {
    return value.name === binding.name;
  });
}

export function findInputParameter(inputOutput, binding) {
  const parameters = inputOutput.get('inputParameters');

  return parameters.find((parameter) => {
    return parameter.name === binding.name;
  });
}

export function findOutputParameter(inputOutput, binding) {
  const parameters = inputOutput.get('outputParameters');

  return parameters.find(function(parameter) {
    const { value } = parameter;

    if (!binding.scriptFormat) {
      return value === binding.source;
    }

    const definition = parameter.get('camunda:definition');

    if (!definition || binding.scriptFormat !== definition.get('camunda:scriptFormat')) {
      return false;
    }

    return definition.get('camunda:value') === binding.source;
  });
}

export function findCamundaErrorEventDefinition(element, errorRef) {
  const errorEventDefinitions = findExtensions(element, [ 'camunda:ErrorEventDefinition' ]);

  let error;

  // error ID has to start with <Error_${ errorRef }_>
  return errorEventDefinitions.find((definition) => {
    error = definition.get('bpmn:errorRef');

    if (error) {
      return error.get('bpmn:id').startsWith(`Error_${ errorRef }`);
    }
  });
}

export function findError(element, errorRef) {
  const root = getRoot(getBusinessObject(element)),
        rootElements = root.get('rootElements');

  return rootElements.find((rootElement) => {
    return is(rootElement, 'bpmn:Error')
      && rootElement.get('id').startsWith(`Error_${ errorRef }`);
  });
}


// helpers //////////

function getExtensionElements(element) {
  const businessObject = getBusinessObject(element);

  if (is(businessObject, 'bpmn:ExtensionElements')) {
    return businessObject;
  } else {
    return businessObject.get('extensionElements');
  }
}


function isInOut(element, binding) {

  if (binding.type === 'camunda:in') {

    // find based on target attribute
    if (binding.target) {
      return element.target === binding.target;
    }
  }

  if (binding.type === 'camunda:out') {

    // find based on source / sourceExpression
    if (binding.source) {
      return element.source === binding.source;
    }

    if (binding.sourceExpression) {
      return element.sourceExpression === binding.sourceExpression;
    }
  }

  // find based variables / local combination
  if (binding.variables) {
    return element.variables === 'all' && (
      binding.variables !== 'local' || element.local
    );
  }
}

function getRoot(businessObject) {
  let parent = businessObject;

  while (parent.$parent) {
    parent = parent.$parent;
  }

  return parent;
}