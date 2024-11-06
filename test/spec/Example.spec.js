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

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import CloudElementTemplatesPropertiesProviderModule from 'src/cloud-element-templates';
import ElementTemplatesPropertiesProviderModule from 'src/element-templates';

import { ElementTemplateLinterPlugin } from 'src/cloud-element-templates/linting';

const singleStart = window.__env__ && window.__env__.SINGLE_START;

insertCoreStyles();
insertBpmnStyles();
insertCSS('bottom-panel.css', `
  .test-container {
    display: flex;
    flex-direction: column;
  }

  .properties-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    width: 250px;
    height: 100%;
    border-left: solid 1px #ccc;
    background-color: #f7f7f8;
  }

  .panel {
    position: absolute;
    bottom: 0;
    left: 0;
    width: calc(100% - 250px - 1px);
    height: 200px;
    display: flex;
    flex-direction: column;
    background-color: #f7f7f8;
    padding: 5px;
    box-sizing: border-box;
    border-top: solid 1px #ccc;
    font-family: sans-serif;
  }

  .panel .errors {
    resize: none;
    flex-grow: 1;
    background-color: #f7f7f8;
    border: none;
    margin-bottom: 5px;
    font-family: sans-serif;
    line-height: 1.5;
    outline: none;
    overflow-y: scroll;
  }

  .panel button,
  .panel input {
    width: 200px;
  }
`);


describe('<BpmnPropertiesPanelRenderer>', function() {

  let modelerContainer;

  let propertiesContainer;

  afterEach(() => cleanup());

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
        zeebe: ZeebeModdle
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
          LintingModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
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

    const modeler = result.modeler;

    const linter = new Linter({
      plugins: [
        ElementTemplateLinterPlugin(elementTemplates)
      ]

    });

    const linting = modeler.get('linting');
    const bpmnjs = modeler.get('bpmnjs');
    const eventBus = modeler.get('eventBus');

    const lint = () => {
      const definitions = bpmnjs.getDefinitions();

      linter.lint(definitions).then(reports => {
        linting.setErrors(reports);

        const errorContainer = panel.querySelector('.errors');
        errorContainer.innerHTML = '';

        reports.forEach((report) => {
          let { id, message, node, data } = report;
          node = node || (data && data.node);
          const name = node && node.name;

          const errorMessage = `${ name || id }: ${ message }`;
          const item = domify(`<div>${escapeHtml(errorMessage)}</div>`);
          item.addEventListener('click', () => {
            linting.showError(report);
          });

          errorContainer.appendChild(item);
        });
      });
    };

    lint();

    eventBus.on('elements.changed', lint);
    linting.activate();

    const propertiesPanelParent = domify('<div class="properties-panel-container"></div>');

    bpmnjs._container.appendChild(propertiesPanelParent);

    modeler.get('propertiesPanel').attachTo(propertiesPanelParent);

    const panel = domify(`
      <div class="panel">
        <div class="errors"></div>
        <div>
          <label>Execution Platform Version</label>
          <input type="text" />
          <button>Deactivate Linting</button>
        </div>
      </div>
    `);

    bpmnjs._container.appendChild(panel);


    // then
    expect(result.error).not.to.exist;
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
          camunda: CamundaModdle
        },
        elementTemplates
      }
    );

    const modeler = result.modeler;
    const bpmnjs = modeler.get('bpmnjs');
    const propertiesPanelParent = domify('<div class="properties-panel-container"></div>');

    bpmnjs._container.appendChild(propertiesPanelParent);

    modeler.get('propertiesPanel').attachTo(propertiesPanelParent);


    // then
    expect(result.error).not.to.exist;
  });

});


const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
};
