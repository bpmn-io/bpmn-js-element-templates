import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';

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
    --example-properties-width: 400px;
    --example-bottom-height: 200px;
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

  .ci-toggle-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 99;
    padding: 6px 12px;
    font-size: 12px;
    font-family: sans-serif;
    cursor: pointer;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .ci-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.3);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ci-modal {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    width: calc(100% - 40px);
    height: calc(100% - 40px);
    overflow-y: auto;
    font-family: sans-serif;
    font-size: 13px;
  }

  .ci-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
  }

  .ci-modal-header h3 {
    margin: 0;
    font-size: 14px;
  }

  .ci-modal-header button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .ci-modal-body {
    padding: 16px;
  }

  .ci-section {
    margin-bottom: 16px;
  }

  .ci-section h4 {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    color: #666;
  }

  .ci-instance-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .ci-instance-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .ci-instance-list li .ci-inst-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ci-instance-list li .ci-inst-name {
    font-weight: 600;
  }

  .ci-instance-list li .ci-inst-meta {
    font-size: 11px;
    color: #888;
  }

  .ci-instance-list li button {
    width: auto;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .ci-create-actions {
    display: flex;
    gap: 8px;
  }

  .ci-create-actions button {
    flex: 1;
    padding: 8px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f7f7f8;
  }

  .ci-create-actions button:hover {
    background: #e8e8ea;
  }

  .ci-form {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fafafa;
  }

  .ci-form h5 {
    margin: 0 0 8px;
    font-size: 12px;
  }

  .ci-form label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 2px;
    color: #444;
  }

  .ci-form input, .ci-form select {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    margin-bottom: 8px;
    box-sizing: border-box;
  }

  .ci-form .ci-form-row {
    margin-bottom: 8px;
  }

  .ci-form .ci-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .ci-form .ci-form-actions button {
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .ci-form .ci-form-actions button[data-primary] {
    background: #0d47a1;
    color: #fff;
    border-color: #0d47a1;
  }

  .ci-empty {
    color: #888;
    font-style: italic;
    padding: 8px 0;
  }

  .xml-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .xml-modal {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    width: calc(100% - 40px);
    height: calc(100% - 40px);
    display: flex;
    flex-direction: column;
    font-family: sans-serif;
  }

  .xml-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
  }

  .xml-modal-header h3 {
    margin: 0;
    font-size: 14px;
  }

  .xml-modal-header button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .xml-modal pre {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 16px;
    font-size: 12px;
    line-height: 1.5;
    background: #1e1e1e;
    color: #d4d4d4;
    border-radius: 0 0 8px 8px;
    white-space: pre-wrap;
    word-break: break-all;
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

const SLACK_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI3IiBoZWlnaHQ9IjEyNyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMjcuMiA4MGMwIDcuMy01LjkgMTMuMi0xMy4yIDEzLjJDNi43IDkzLjIuOCA4Ny4zLjggODBjMC03LjMgNS45LTEzLjIgMTMuMi0xMy4yaDEzLjJWODB6bTYuNiAwYzAtNy4zIDUuOS0xMy4yIDEzLjItMTMuMiA3LjMgMCAxMy4yIDUuOSAxMy4yIDEzLjJ2MzNjMCA3LjMtNS45IDEzLjItMTMuMiAxMy4yLTcuMyAwLTEzLjItNS45LTEzLjItMTMuMlY4MHoiIGZpbGw9IiNFMDFFNUEiLz4KICA8cGF0aCBkPSJNNDcgMjdjLTcuMyAwLTEzLjItNS45LTEzLjItMTMuMkMzMy44IDYuNSAzOS43LjYgNDcgLjZjNy4zIDAgMTMuMiA1LjkgMTMuMiAxMy4yVjI3SDQ3em0wIDYuN2M3LjMgMCAxMy4yIDUuOSAxMy4yIDEzLjIgMCA3LjMtNS45IDEzLjItMTMuMiAxMy4ySDEzLjlDNi42IDYwLjEuNyA1NC4yLjcgNDYuOWMwLTcuMyA1LjktMTMuMiAxMy4yLTEzLjJINDd6IiBmaWxsPSIjMzZDNUYwIi8+CiAgPHBhdGggZD0iTTk5LjkgNDYuOWMwLTcuMyA1LjktMTMuMiAxMy4yLTEzLjIgNy4zIDAgMTMuMiA1LjkgMTMuMiAxMy4yIDAgNy4zLTUuOSAxMy4yLTEzLjIgMTMuMkg5OS45VjQ2Ljl6bS02LjYgMGMwIDcuMy01LjkgMTMuMi0xMy4yIDEzLjItNy4zIDAtMTMuMi01LjktMTMuMi0xMy4yVjEzLjhDNjYuOSA2LjUgNzIuOC42IDgwLjEuNmM3LjMgMCAxMy4yIDUuOSAxMy4yIDEzLjJ2MzMuMXoiIGZpbGw9IiMyRUI2N0QiLz4KICA8cGF0aCBkPSJNODAuMSA5OS44YzcuMyAwIDEzLjIgNS45IDEzLjIgMTMuMiAwIDcuMy01LjkgMTMuMi0xMy4yIDEzLjItNy4zIDAtMTMuMi01LjktMTMuMi0xMy4yVjk5LjhoMTMuMnptMC02LjZjLTcuMyAwLTEzLjItNS45LTEzLjItMTMuMiAwLTcuMyA1LjktMTMuMiAxMy4yLTEzLjJoMzMuMWM3LjMgMCAxMy4yIDUuOSAxMy4yIDEzLjIgMCA3LjMtNS45IDEzLjItMTMuMiAxMy4ySDgwLjF6IiBmaWxsPSIjRUNCMjJFIi8+Cjwvc3ZnPgo=';

const SAMPLE_CONNECTIONS = [
  {
    name: 'slackProduction',
    displayName: 'Slack Production',
    templateRef: 'io.camunda:slack-connection:1',
    version: 3,
    type: 'Slack',
    authType: 'Bearer token',
    status: 'active',
    icon: SLACK_ICON
  },
  {
    name: 'slackDevelopment',
    displayName: 'Slack Development',
    templateRef: 'io.camunda:slack-connection:1',
    version: 2,
    type: 'Slack',
    authType: 'Bearer token',
    status: 'inactive',
    icon: SLACK_ICON
  },
  {
    name: 'slackLegacy',
    displayName: 'Slack Legacy (v1)',
    templateRef: 'io.camunda:slack-connection:1',
    version: 1,
    type: 'Slack',
    authType: 'Bot token',
    status: 'active',
    icon: SLACK_ICON
  },
  {
    name: 'slackStaging',
    displayName: 'Slack Staging',
    templateRef: 'io.camunda:slack-connection:1',
    version: 2,
    type: 'Slack',
    authType: 'OAuth2',
    status: 'active',
    icon: SLACK_ICON
  },
  {
    name: 'awsMainAccount',
    displayName: 'AWS Main Account',
    templateRef: 'io.camunda:aws-connection:1',
    version: 1,
    type: 'AWS',
    authType: 'Access Key',
    status: 'active'
  },
  {
    name: 'gcpProjectAlpha',
    displayName: 'GCP Project Alpha',
    templateRef: 'io.camunda:gcp-connection:1',
    version: 1,
    type: 'GCP',
    authType: 'Service Account',
    status: 'active'
  },
  {
    name: 'sendgridMarketing',
    displayName: 'SendGrid Marketing',
    templateRef: 'io.camunda:sendgrid-connection:1',
    version: 2,
    type: 'SendGrid',
    authType: 'API key',
    status: 'inactive'
  }
];

const FETCH_DELAY = 1500; // ms — simulated network latency for demo

const MockConfigurationInstancesModule = {

  __init__: [ function(configurationInstances) {

    // Register a fetch function with simulated delay
    configurationInstances.setFetchFn(async () => {
      await new Promise(resolve => setTimeout(resolve, FETCH_DELAY));
      return [ ...SAMPLE_CONNECTIONS ];
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

    const elementTemplates = require('test/spec/cloud-element-templates/fixtures/connections-design.json');

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
          MockConfigurationInstancesModule,
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

  // --- Connection instances modal ---
  const configurationInstances = modeler.get('configurationInstances', false);

  const configurationTemplates = modeler.get('configurationTemplates', false);

  if (configurationInstances) {

    // Toggle button
    const toggleBtn = domify('<button class="ci-toggle-btn">⚙ Connections</button>');
    container.appendChild(toggleBtn);

    let backdrop = null;

    const closeModal = () => {
      if (backdrop) {
        backdrop.remove();
        backdrop = null;
      }
    };

    const openModal = () => {
      if (backdrop) return;

      backdrop = domify('<div class="ci-modal-backdrop"></div>');
      const modal = domify('<div class="ci-modal"></div>');
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });

      renderModal(modal);
    };

    const renderModal = (modal) => {
      const all = configurationInstances.getAll();
      const loaded = configurationInstances.isLoaded();

      modal.innerHTML = `
        <div class="ci-modal-header">
          <h3>Connection Instances (Hub simulation)</h3>
          <button data-close>&times;</button>
        </div>
        <div class="ci-modal-body">
          <div class="ci-section">
            <h4>Existing instances${ loaded ? '' : ' (not loaded — cluster disconnected)' }</h4>
            <div class="ci-list-container"></div>
          </div>
          <div class="ci-section">
            <h4>Create new connection</h4>
            <div class="ci-create-actions">
              <button data-action="random">Create random (Slack)</button>
              <button data-action="explicit">Create from template…</button>
            </div>
            <div class="ci-form-container"></div>
          </div>
          <div class="ci-section">
            <h4>Bulk actions</h4>
            <div class="ci-create-actions">
              <button data-action="load-samples">Load samples</button>
              <button data-action="mark-loaded">Mark loaded (empty)</button>
            </div>
          </div>
        </div>
      `;

      modal.querySelector('[data-close]').addEventListener('click', closeModal);

      // Render instance list
      const listContainer = modal.querySelector('.ci-list-container');

      if (all.length === 0) {
        listContainer.innerHTML = '<p class="ci-empty">No connection instances available.</p>';
      } else {
        const list = domify('<ul class="ci-instance-list"></ul>');

        all.forEach((inst, idx) => {
          const li = domify(
            `<li>
              <div class="ci-inst-info">
                <span class="ci-inst-name">${ escapeHTML(inst.displayName || inst.name) }</span>
                <span class="ci-inst-meta">${ escapeHTML(inst.templateRef) } v${ inst.version || '?' } · ${ escapeHTML(inst.authType || '-') } · ${ escapeHTML(inst.status || '-') }</span>
              </div>
              <button data-remove="${ idx }">Remove</button>
            </li>`
          );

          li.querySelector('button').addEventListener('click', () => {
            const updated = configurationInstances.getAll().filter((_, i) => i !== idx);
            configurationInstances.setInstances(updated);
            renderModal(modal);
          });

          list.appendChild(li);
        });

        listContainer.appendChild(list);
      }

      // Random creation
      modal.querySelector('[data-action="random"]').addEventListener('click', () => {
        const id = Math.random().toString(36).slice(2, 7);
        const current = configurationInstances.getAll();
        const authTypes = [ 'Bearer token', 'OAuth2', 'Bot token' ];

        configurationInstances.setInstances([
          ...current,
          {
            name: 'slack_' + id,
            displayName: 'Slack ' + id.charAt(0).toUpperCase() + id.slice(1),
            templateRef: 'io.camunda:slack-connection:1',
            version: Math.ceil(Math.random() * 3),
            type: 'Slack',
            authType: authTypes[Math.floor(Math.random() * authTypes.length)],
            status: Math.random() > 0.3 ? 'active' : 'inactive',
            icon: SLACK_ICON
          }
        ]);

        renderModal(modal);
      });

      // Explicit creation — render connection template form
      const formContainer = modal.querySelector('.ci-form-container');

      modal.querySelector('[data-action="explicit"]').addEventListener('click', () => {
        const tmpl = configurationTemplates.getLatest()[0]; // first available

        formContainer.innerHTML = '';

        const form = domify(
          `<div class="ci-form">
            <h5>New "${ escapeHTML(tmpl.name) }" — fill in fields as Hub would render them</h5>
            <div class="ci-form-row">
              <label>Instance name (cluster variable key)</label>
              <input type="text" data-field="name" placeholder="e.g. slackProduction" />
            </div>
            <div class="ci-form-row">
              <label>Display name</label>
              <input type="text" data-field="displayName" placeholder="e.g. Slack Production" />
            </div>
            <div class="ci-form-row">
              <label>Version (stamped from template)</label>
              <label style="display:inline-flex;align-items:center;gap:4px;font-weight:normal;font-size:11px;color:#888;margin-bottom:4px;">
                <input type="checkbox" data-field="overrideVersion" />
                Override version (demo only — simulate outdated instances)
              </label>
              <input type="number" data-field="version" value="${ tmpl.version }" min="1" disabled />
            </div>
            <hr/>
            <p style="font-size:11px;color:#666;margin:4px 0 8px;">
              Below: connection template properties (the JSON object stored as cluster variable)
            </p>
            ${ tmpl.properties.map(p =>
              `<div class="ci-form-row">
                <label>${ escapeHTML(p.label) }${ p.required ? ' *' : '' }</label>
                <input type="text" data-prop="${ escapeHTML(p.key) }" placeholder="${ escapeHTML(p.key) }" />
              </div>`
            ).join('') }
            <div class="ci-form-actions">
              <button data-primary data-action="submit">Create connection</button>
              <button data-action="cancel">Cancel</button>
            </div>
          </div>`
        );

        // Toggle version override
        form.querySelector('[data-field="overrideVersion"]').addEventListener('change', (e) => {
          form.querySelector('[data-field="version"]').disabled = !e.target.checked;
        });

        form.querySelector('[data-action="cancel"]').addEventListener('click', () => {
          formContainer.innerHTML = '';
        });

        form.querySelector('[data-action="submit"]').addEventListener('click', () => {
          const name = form.querySelector('[data-field="name"]').value.trim();
          const displayName = form.querySelector('[data-field="displayName"]').value.trim();
          const version = parseInt(form.querySelector('[data-field="version"]').value, 10) || 1;

          if (!name) {
            alert('Instance name is required');
            return;
          }

          const current = configurationInstances.getAll();

          configurationInstances.setInstances([
            ...current,
            {
              name,
              displayName: displayName || name,
              templateRef: tmpl.id,
              version,
              type: 'Slack',
              authType: 'Bearer token',
              status: 'active',
              icon: tmpl.icon
            }
          ]);

          formContainer.innerHTML = '';
          renderModal(modal);
        });

        formContainer.appendChild(form);
      });

      // Bulk actions
      modal.querySelector('[data-action="load-samples"]').addEventListener('click', () => {
        configurationInstances.setInstances([ ...SAMPLE_CONNECTIONS ]);
        renderModal(modal);
      });

      modal.querySelector('[data-action="mark-loaded"]').addEventListener('click', () => {
        configurationInstances.setInstances([]);
        renderModal(modal);
      });
    };

    toggleBtn.addEventListener('click', openModal);
  }

  // --- XML viewer button ---
  const xmlBtn = domify('<button class="ci-toggle-btn" style="left: 130px;">&#60;/&#62; XML</button>');
  container.appendChild(xmlBtn);

  xmlBtn.addEventListener('click', async () => {
    const { xml } = await bpmnjs.saveXML({ format: true });

    const backdrop = domify('<div class="xml-modal-backdrop"></div>');
    const modal = domify(
      `<div class="xml-modal">
        <div class="xml-modal-header">
          <h3>BPMN XML</h3>
          <button data-close>&times;</button>
        </div>
        <pre></pre>
      </div>`
    );

    modal.querySelector('pre').textContent = xml;
    modal.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  });

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