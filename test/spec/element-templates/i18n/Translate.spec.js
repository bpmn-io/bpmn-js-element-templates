import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';

import {
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import {
  bootstrapPropertiesPanel,
  inject
} from 'test/TestHelper';

import {
  act
} from '@testing-library/preact';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/element-templates';
import modelingModule from 'bpmn-js/lib/features/modeling';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';
import camundaModdlePackage from 'camunda-bpmn-moddle/resources/camunda';

import diagramXML from './Translate.bpmn';

import templates from './Translate.templates';

describe('provider/element-templates - Translate', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapPropertiesPanel(diagramXML, {
    container,
    modules: [
      BpmnPropertiesPanelModule,
      coreModule,
      elementTemplatesModule,
      modelingModule,
      {
        translate: [
          'value',
          (template, replacements) => replacements
            ? `${template}:translated:${JSON.stringify(replacements)}`
            : `${template}:translated`
        ]
      }
    ],
    moddleExtensions: {
      camunda: camundaModdlePackage
    },
    elementTemplates: templates
  }));

  beforeEach(inject(async function(elementRegistry, selection) {
    const element = elementRegistry.get('ServiceTask_1');
    await act(() => selection.select(element));
  }));

  describe('Template group', function() {
    it('should apply the `translate` service for the Template group title', inject(function() {
      const titleEl = domQuery('[data-group-id="group-ElementTemplates__Template"] .bio-properties-panel-group-header-title', container);

      expect(titleEl.textContent).to.equal('Template:translated');
    }));
  });

  describe('Custom Properties group', function() {
    it('should apply the `translate` service for the Custom Properties group title', inject(function() {
      const titleEl = domQuery('[data-group-id="group-ElementTemplates__CustomProperties"] .bio-properties-panel-group-header-title', container);

      expect(titleEl.textContent).to.equal('Custom properties:translated');
    }));

    it('should apply the `translate` service for a Boolean entry', inject(function() {
      const booleanEntry = domQuery('[data-group-id="group-ElementTemplates__CustomProperties"] [data-entry-id="custom-entry-foo-0"]', container);

      const labelEl = domQuery('.bio-properties-panel-label', booleanEntry);
      expect(labelEl.textContent).to.equal('BooleanLabel:translated');

      const descriptionEl = domQuery('.bio-properties-panel-description', booleanEntry);
      expect(descriptionEl.textContent).to.equal('BooleanDescription:translated');
    }));

    it('should apply the `translate` service for a Dropdown entry', inject(function() {
      const dropdownEntry = domQuery('[data-group-id="group-ElementTemplates__CustomProperties"] [data-entry-id="custom-entry-foo-1"]', container);

      const labelEl = domQuery('.bio-properties-panel-label', dropdownEntry);
      expect(labelEl.textContent).to.equal('DropdownLabel:translated');

      const descriptionEl = domQuery('.bio-properties-panel-description', dropdownEntry);
      expect(descriptionEl.textContent).to.equal('DropdownDescription:translated');

      const options = domQueryAll('option', dropdownEntry);
      expect(options[0].textContent).to.equal('Choice1:translated');
      expect(options[1].textContent).to.equal('Choice2:translated');
    }));

    it('should apply the `translate` service for a String entry', inject(function() {
      const stringEntry = domQuery('[data-group-id="group-ElementTemplates__CustomProperties"] [data-entry-id="custom-entry-foo-2"]', container);

      const labelEl = domQuery('.bio-properties-panel-label', stringEntry);
      expect(labelEl.textContent).to.equal('StringLabel:translated');

      const descriptionEl = domQuery('.bio-properties-panel-description', stringEntry);
      expect(descriptionEl.textContent).to.equal('StringDescription:translated');
    }));

    it('should apply the `translate` service for a Text entry', inject(function() {
      const textEntry = domQuery('[data-group-id="group-ElementTemplates__CustomProperties"] [data-entry-id="custom-entry-foo-3"]', container);

      const labelEl = domQuery('.bio-properties-panel-label', textEntry);
      expect(labelEl.textContent).to.equal('TextLabel:translated');

      const descriptionEl = domQuery('.bio-properties-panel-description', textEntry);
      expect(descriptionEl.textContent).to.equal('TextDescription:translated');
    }));
  });
});
