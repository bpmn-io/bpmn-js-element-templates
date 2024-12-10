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

export const ElementTemplateLinterPlugin = function(templates) {
  return {
    config: {
      rules: {
        'element-templates/validate': [ 'error', { templates } ],
        'element-templates/compatibility': [ 'warn', { templates } ]
      }
    },
    resolver: new StaticResolver({
      'rule:bpmnlint-plugin-element-templates/validate': validate,
      'rule:bpmnlint-plugin-element-templates/compatibility': compatibility
    })
  };
};
