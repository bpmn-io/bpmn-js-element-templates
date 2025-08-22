import { is } from 'bpmn-js/lib/util/ModelUtil';
import EventBus from 'diagram-js/lib/core/EventBus';

import ElementTemplates from '../../ElementTemplates';
import { getPropertyValue, validateProperty } from '../../util/propertyUtil';
import { applyConditions } from '../../Condition';
import { GlobalCache, getCachedValidator, createTemplateKey } from '../cache/GlobalCache';

const DEBUG = true;

function debugLog(message, ...args) {
  if (DEBUG) {
    console.log('[element-templates-validate]', message, ...args);
  }
}

// Global validation cache
const validationCache = new GlobalCache('element-templates-validate', 5000, 500);

export default function({ templates = [] }) {

  // validationCache.flush();

  const { validTemplates } = getCachedValidator(templates, debugLog);

  debugLog('Initialized with templates:', templates.length, 'valid:', validTemplates.length);

  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(validTemplates);

  function check(node, reporter) {
    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    debugLog('Checking node:', node.id, 'type:', node.$type);

    let template = elementTemplates.get(node);
    const templateId = elementTemplates._getTemplateId(node);

    // Handle missing template
    if (templateId && !template) {
      debugLog('Template not found for node:', node.id, 'templateId:', templateId);
      reporter.report(
        node.id,
        'Linked element template not found',
        {
          name: node.name
        }
      );
      return;
    }

    if (!template) {
      debugLog('No template associated with node:', node.id);
      return;
    }

    debugLog('Using template:', template.id, 'version:', template.version, 'for node:', node.id);

    template = applyConditions(node, template);

    // Create hash that includes both template and current property values
    const templateHash = createTemplateKey(template);
    const propertyValues = template.properties.map(prop => ({
      id: prop.id,
      value: getPropertyValue(node, prop)
    }));
    const propertyHash = createTemplateKey(propertyValues);

    const cacheKey = `${node.id}_${templateHash}_${propertyHash}`;

    if (validationCache.has(cacheKey)) {
      const cachedErrors = validationCache.get(cacheKey);
      debugLog('Global validation cache hit for node:', node.id, 'returning', cachedErrors.length, 'cached errors');
      cachedErrors.forEach(error => {
        reporter.report(node.id, error.message, error.context);
      });
      return;
    }

    debugLog('Global validation cache miss for node:', node.id, 'performing validation');

    const errors = [];

    // Check attributes and collect errors
    template.properties.forEach((property) => {
      const value = getPropertyValue(node, property);
      const error = validateProperty(value, property);

      if (error) {
        debugLog('Validation error for property:', property.binding?.name || property.id, 'error:', error);
        const errorData = {
          message: error,
          context: {
            propertiesPanel: {
              entryIds: [ getEntryId(property, template) ]
            },
            name: node.name
          }
        };

        errors.push(errorData);
        reporter.report(node.id, error, errorData.context);
      }
    });

    debugLog('Validation completed for node:', node.id, 'found', errors.length, 'errors');

    // Cache the results globally
    validationCache.set(cacheKey, errors);
  }

  return {
    check
  };
}

// helpers //////////////////////

function getEntryId(property, template) {
  const index = template.properties
    .filter(p => p.group === property.group)
    .indexOf(property);

  const path = [ 'custom-entry', template.id ];

  if (property.group) {
    path.push(property.group);
  }

  path.push(index);
  return path.join('-');
}