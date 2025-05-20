import TestContainer from 'mocha-test-container-support';

import {
  cleanup
} from '@testing-library/preact/pure';

import { domify } from 'min-dom';

import {
  clearBpmnJS,
  setBpmnJS,
  insertCoreStyles,
  insertBpmnStyles,
  insertCSS,
  enableLogging
} from 'test/TestHelper';

import Modeler from 'bpmn-js/lib/Modeler';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';

import LintingModule from '@camunda/linting/modeler';
import { Linter } from '@camunda/linting';

import ElementTemplateChooserModule from '@bpmn-io/element-template-chooser';
import ElementTemplatesIconsRenderer from '@bpmn-io/element-template-icon-renderer';

import {
  CreateAppendAnythingModule,
  CreateAppendElementTemplatesModule
} from 'bpmn-js-create-append-anything';

import CamundaBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-platform';
import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';

import CamundaModdle from 'camunda-bpmn-moddle/resources/camunda';
import ModelerModdle from 'modeler-moddle/resources/modeler';
import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import CloudElementTemplatesPropertiesProviderModule from 'src/cloud-element-templates';
import ElementTemplatesPropertiesProviderModule from 'src/element-templates';

import { ElementTemplateLinterPlugin } from 'src/cloud-element-templates/linting';

const singleStart = window.__env__ && window.__env__.SINGLE_START;

insertCoreStyles();
insertBpmnStyles();

insertCSS('example.css', `
  .test-container {
    display: flex;
    flex-direction: column;
  }

  .test-container {
    --example-properties-width: 20vw;
    --example-bottom-height: 30vh;
  }

  .bjs-container {
    padding-right: var(--example-properties-width);
    padding-bottom: var(--example-bottom-height);
  }

  .properties-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--example-properties-width);
    height: 100%;
    border-left: solid 1px #ccc;
    background-color: #f7f7f8;
  }

  .bottom-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    width: calc(100% - var(--example-properties-width) - 1px);
    height: var(--example-bottom-height);
    display: flex;
    flex-direction: column;
    background-color: #f7f7f8;
    box-sizing: border-box;
    border-top: solid 1px #ccc;
    font-family: sans-serif;
  }

  .bottom-panel .error-container {
    resize: none;
    flex-grow: 1;
    background-color: #f7f7f8;
    border: none;
    padding: 5px;
    font-family: sans-serif;
    line-height: 1.5;
    outline: none;
    overflow: auto;
  }

  .bottom-panel .error-item {
    cursor: pointer;
  }

  .bottom-panel .footer-container {
    border-top: solid 1px #ccc;
    padding: 5px;
  }

  .bottom-panel button,
  .bottom-panel input {
    width: 200px;
  }
`);


const ChangeEnginesModule = {

  __init__: [ function(bpmnjs, eventBus, elementTemplates) {

    eventBus.on([
      'import.done',
      'elements.changed'
    ], function() {
      const executionPlatformVersion = bpmnjs.getDefinitions().get('executionPlatformVersion');

      if (elementTemplates.getEngines().camunda !== executionPlatformVersion) {
        elementTemplates.setEngines({
          camunda: executionPlatformVersion
        });
      }
    });
  } ]
};

const LogTemplateErrorsModule = {

  __init__: [ function(eventBus) {

    eventBus.on('elementTemplates.errors', function({ errors }) {
      console.error('element template parse errors', errors);
    });
  } ]
};


describe('<BpmnPropertiesPanelRenderer>', function() {

  let modelerContainer;

  let propertiesContainer;

  afterEach(function() {
    cleanup();
  });

  let container;

  beforeEach(function() {
    modelerContainer = document.createElement('div');
    modelerContainer.classList.add('modeler-container');

    container = TestContainer.get(this);
    container.appendChild(modelerContainer);
  });

  async function createModeler(xml, options = { }, BpmnJS = Modeler) {
    const {
      shouldImport = true,
      additionalModules = [
        ZeebeBehaviorsModule,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ZeebePropertiesProviderModule,
        CreateAppendAnythingModule,
        CreateAppendElementTemplatesModule,
        LintingModule
      ],
      moddleExtensions = {
        zeebe: ZeebeModdle,
        modeler: ModelerModdle
      },
      propertiesPanel = {},
      description = {},
      layout = {},
    } = options;

    clearBpmnJS();

    const modeler = new BpmnJS({
      container: modelerContainer,
      additionalModules,
      moddleExtensions,
      propertiesPanel: {
        parent: propertiesContainer,
        feelTooltipContainer: container,
        description,
        layout,
        ...propertiesPanel
      },
      ...options
    });

    enableLogging && enableLogging(modeler, !!singleStart);

    setBpmnJS(modeler);

    if (!shouldImport) {
      return { modeler };
    }

    try {
      const result = await modeler.importXML(xml);

      return { error: null, warnings: result.warnings, modeler: modeler };
    } catch (err) {
      return { error: err, warnings: err.warnings, modeler: modeler };
    }
  }


  (singleStart === 'cloud-templates' ? it.only : it)('should import simple process (cloud-templates)', async function() {

    // given
    const diagramXml = require('test/spec/cloud-element-templates/fixtures/complex.bpmn').default;

    const elementTemplateContext = require.context('test/spec/cloud-element-templates/fixtures', false, /\.json$/);

    const elementTemplates = elementTemplateContext.keys().map(key => elementTemplateContext(key)).flat();

    // when
    const result = await createModeler(
      diagramXml,
      {
        additionalModules: [
          ZeebeBehaviorsModule,
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          ZeebePropertiesProviderModule,
          CloudElementTemplatesPropertiesProviderModule,
          ElementTemplateChooserModule,
          ElementTemplatesIconsRenderer,
          CreateAppendAnythingModule,
          CreateAppendElementTemplatesModule,
          ChangeEnginesModule,
          LogTemplateErrorsModule,
          LintingModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle,
          modeler: ModelerModdle
        },
        propertiesPanel: {
          parent: null
        },
        elementTemplates,
        linting: {
          active: true
        }
      }
    );

    // then
    expect(result.error).not.to.exist;

    // and
    createTestUI(result.modeler);
  });


  (singleStart === 'templates' ? it.only : it)('should import simple process (templates)', async function() {

    // given
    const diagramXml = require('test/spec/element-templates/fixtures/complex.bpmn').default;

    const elementTemplateContext = require.context('test/spec/element-templates/fixtures', false, /\.json$/);

    const elementTemplates = elementTemplateContext.keys().map(key => elementTemplateContext(key)).flat();

    // when
    const result = await createModeler(
      diagramXml,
      {
        additionalModules: [
          CamundaBehaviorsModule,
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          ElementTemplateChooserModule,
          ElementTemplatesPropertiesProviderModule
        ],
        moddleExtensions: {
          camunda: CamundaModdle,
          modeler: ModelerModdle
        },
        elementTemplates
      }
    );

    // then
    expect(result.error).not.to.exist;

    // and then
    createTestUI(result.modeler);
  });

});


function escapeHTML(unsafe) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function createTestUI(modeler) {

  const linting = modeler.get('linting', false);
  const elementTemplates = modeler.get('elementTemplates', false);
  const propertiesPanel = modeler.get('propertiesPanel', false);

  const canvas = modeler.get('canvas');
  const modeling = modeler.get('modeling');
  const bpmnjs = modeler.get('bpmnjs');
  const eventBus = modeler.get('eventBus');

  const container = bpmnjs._container;

  if (propertiesPanel) {

    const propertiesPanelParent = domify('<div class="properties-panel-container"></div>');

    container.appendChild(propertiesPanelParent);

    propertiesPanel.attachTo(propertiesPanelParent);
  }

  if (linting && elementTemplates) {
    const linter = new Linter({
      plugins: [
        ElementTemplateLinterPlugin(elementTemplates.getAll())
      ]
    });

    const bottomPanel = domify(`
      <div class="bottom-panel">
        <div class="error-container"></div>
        <div class="footer-container">
          <label>Execution Platform Version</label>
          <input type="text" />
        </div>
      </div>
    `);

    container.appendChild(bottomPanel);

    bottomPanel.querySelector('input').value = bpmnjs.getDefinitions().get('executionPlatformVersion');

    bottomPanel.querySelector('input').addEventListener('input', ({ target }) => {
      modeling.updateModdleProperties(
        canvas.getRootElement(),
        bpmnjs.getDefinitions(),
        { executionPlatformVersion: target.value }
      );
    });

    const lint = () => {
      const definitions = bpmnjs.getDefinitions();

      linter.lint(definitions).then(reports => {
        linting.setErrors(reports);

        const errorContainer = bottomPanel.querySelector('.error-container');
        errorContainer.innerHTML = '';

        reports.map((report) => {
          const { id, message, category, rule, documentation } = report;

          if (category === 'rule-error') {
            return domify(`<div class="error-item"><strong>${ category }</strong> Rule <${ escapeHTML(rule) }> errored with the following message: ${ escapeHTML(message) }</div>`);
          }

          const element = domify(`<div class="error-item"><strong>${ category }</strong> ${ id }: ${escapeHTML(message) } </div>`);

          if (documentation?.url) {
            const documentationLink = domify(`<a href="${ documentation.url }" rel="noopener" target="_blank">ref</a>`);

            documentationLink.addEventListener('click', e => e.stopPropagation());

            element.appendChild(documentationLink);
          }

          element.addEventListener('click', () => {
            linting.showError(report);
          });

          return element;
        }).forEach(item => errorContainer.appendChild(item));
      });
    };

    linting.activate();

    lint();

    eventBus.on('elements.changed', lint);
  }
}