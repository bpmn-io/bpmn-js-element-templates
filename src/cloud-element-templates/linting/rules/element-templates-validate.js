/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import ElementTemplates from '../../ElementTemplates';
import EventBus from 'diagram-js/lib/core/EventBus';
import { is } from 'bpmn-js/lib/util/ModelUtil';

import { getPropertyValue, validateProperty } from '../../util/propertyUtil';

import { applyConditions } from '../../Condition';

export default function({ templates = [] }) {

  // We use the ElementTemplates Module without the required bpmn-js modules
  // As we only use it to facilitate template ID and version lookup,
  // access to commandstack etc. is not required
  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(templates);

  function check(node, reporter) {

    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    let template = elementTemplates.get(node);

    const templateId = elementTemplates._getTemplateId(node);

    // Handle missing template
    if (templateId && !template) {
      reporter.report(
        node.id,
        `Linked element template '${templateId}' not found`,
        {
          name: node.name
        }
      );
      return;
    }

    if (!template) {
      return;
    }

    template = applyConditions(node, template);

    // Check attributes
    template.properties.forEach((property) => {
      const value = getPropertyValue(node, property);
      const error = validateProperty(value, property);

      if (!error) {
        return;
      }

      reporter.report(
        node.id,
        error,
        {
          propertiesPanel: {
            entryIds: [ getEntryId(property, template) ]
          },
          name: node.name
        }
      );
    });
  }

  return {
    check
  };

};

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
