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

import validate from './rules/element-templates-validate';
import compatibility from './rules/element-templates-compatibility';


import BpmnModdle from 'bpmn-moddle';

import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { Validator } from '../Validator';

let lastTemplates = [],
    lastValidTemplates = [];

export const ElementTemplateLinterPlugin = function(templates) {

  if (!templatesEqual(lastTemplates, templates)) {
    const moddle = new BpmnModdle({ zeebe: zeebeModdle });

    const validator = new Validator(moddle).addAll(templates);
    const validTemplates = validator.getValidTemplates();
    lastTemplates = templates;
    lastValidTemplates = validTemplates;
  }

  return {
    config: {
      rules: {
        'element-templates/validate': [ 'error', { templates: lastValidTemplates } ],
        'element-templates/compatibility': [ 'warn', { templates: lastValidTemplates } ]
      }
    },
    resolver: new StaticResolver({
      'rule:bpmnlint-plugin-element-templates/validate': validate,
      'rule:bpmnlint-plugin-element-templates/compatibility': compatibility
    })
  };
};

function templatesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}
