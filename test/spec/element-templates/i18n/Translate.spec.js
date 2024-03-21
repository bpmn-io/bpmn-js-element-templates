import TestContainer from 'mocha-test-container-support';

import {
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import {
  act,
} from '@testing-library/preact';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/element-templates';
import modelingModule from 'bpmn-js/lib/features/modeling';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';
import camundaModdlePackage from 'camunda-bpmn-moddle/resources/camunda';

import diagramXML from './Translate.bpmn';

import templates from './Translate.templates';

import customTranslate from './customTranslate';

describe('provider/element-templates - ElementTemplates', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapModeler(diagramXML, {
    container,
    modules: [
      BpmnPropertiesPanelModule,
      coreModule,
      elementTemplatesModule,
      modelingModule,
      {
        translate: [ 'value', customTranslate ]
      }
    ],
    moddleExtensions: {
      camunda: camundaModdlePackage
    },
    elementTemplates: templates
  }));

  describe('translate', function() {
    it('should translate', inject(
      async function(elementRegistry, elementTemplates, selection) {

        const element = elementRegistry.get('ServiceTask_1');

        await act(() => {
          selection.select(element);
        });

        const groups = domQueryAll('[data-group-id]', container);

        console.log(groups.length);
      }
    ));
  });
});
