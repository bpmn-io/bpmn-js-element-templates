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
import { getEnginesConfig } from './utils';

export default function({ templates = [] }) {

  // We use the ElementTemplates Module without the required bpmn-js modules
  // As we only use it to facilitate template ID and version lookup,
  // access to commandstack etc. is not required
  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(templates);

  function check(node, reporter) {

    if (is(node, 'bpmn:Definitions')) {
      elementTemplates.setEngines(getEnginesConfig(node));
    }

    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    const template = elementTemplates.get(node);

    if (!template) {
      return;
    }

    const latestTemplate = elementTemplates.getLatest(template.id, { deprecated: true })[0];

    if (latestTemplate && latestTemplate !== template) {
      reporter.report(node.id, 'Element has updated template available.', {
        name: node.name
      });
    }
  }

  return {
    check
  };
}
