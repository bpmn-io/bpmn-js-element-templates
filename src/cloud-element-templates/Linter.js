/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import StaticResolver from 'bpmnlint/lib/resolver/static-resolver';
import ElementTemplates from './ElementTemplates';
import { getPropertyValue, validateProperty } from './util/propertyUtil';

import { applyConditions } from './Condition';

import BpmnModdle from 'bpmn-moddle';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { Validator } from './Validator';

export const elementTemplateLintRule = ({ templates = [] }) => {
  const moddle = new BpmnModdle({ zeebe: zeebeModdle });

  const validator = new Validator(moddle).addAll(templates);
  const validTemplates = validator.getValidTemplates();

  // We use the ElementTemplates Module without the required bpmn-js modules
  // As we only use it to facilitate template ID and version lookup,
  // access to commandstack etc. is not required
  const elementTemplates = new ElementTemplates();
  elementTemplates.set(validTemplates);

  function check(node, reporter) {

    let template = elementTemplates.get(node);

    const templateId = elementTemplates._getTemplateId(node);

    // Handle missing template
    if (templateId && !template) {
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
        `${property.label} ${firstLetterToLowerCase(error)}`,
        {
          entryIds: [ getEntryId(property, template) ],
          name: node.name
        }
      );
    });
  }

  return {
    check
  };

};


export const ElementTemplateLinterPlugin = function(templates) {
  return {
    config: {
      rules: {
        'element-templates/validate': [ 'error', { templates } ]
      }
    },
    resolver: new StaticResolver({
      'rule:bpmnlint-plugin-element-templates/validate': elementTemplateLintRule
    })
  };
};


// helpers //////////////////////

function firstLetterToLowerCase(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}

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