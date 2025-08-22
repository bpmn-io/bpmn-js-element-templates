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
import validateCached from './rules/element-templates-validate-cached';
import compatibility from './rules/element-templates-compatibility';
import compatibilityCached from './rules/element-templates-compatibility-cached';


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

export const ElementTemplateCachedLinterPlugin = function(templates) {
  return {
    config: {
      rules: {
        'element-templates/validate-cached': [ 'error', { templates } ],
        'element-templates/compatibility-cached': [ 'warn', { templates } ]
      }
    },
    resolver: new StaticResolver({
      'rule:bpmnlint-plugin-element-templates/validate-cached': validateCached,
      'rule:bpmnlint-plugin-element-templates/compatibility-cached': compatibilityCached
    })
  };
};
