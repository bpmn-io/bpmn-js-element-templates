import { expect } from 'chai';
import * as sinon from 'sinon';
import TestContainer from 'mocha-test-container-support';

import {
  act,
  cleanup
} from '@testing-library/preact/pure';

import {
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';
import CamundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesPanelViewerModule,
  BpmnPropertiesProviderModule,
  BpmnPropertiesProviderViewerModule,
  CamundaPlatformPropertiesProviderModule,
  CamundaPlatformPropertiesProviderViewerModule,
  ZeebePropertiesProviderModule,
  ZeebePropertiesProviderViewerModule
} from 'bpmn-js-properties-panel';

import {
  CloudElementTemplatesCoreViewerModule,
  CloudElementTemplatesPropertiesProviderModule,
  CloudElementTemplatesPropertiesProviderViewerModule,
  ElementTemplatesCoreViewerModule,
  ElementTemplatesPropertiesProviderModule,
  ElementTemplatesPropertiesProviderViewerModule
} from 'src';

import {
  insertBpmnStyles,
  insertCoreStyles
} from 'test/TestHelper';

import ElementTemplatesIconsRenderer from '@bpmn-io/element-template-icon-renderer';

import cloudDiagram from './cloud-element-templates.bpmn';
import cloudTemplates from './cloud-element-templates.json';

import platformDiagram from './element-templates.bpmn';
import platformTemplates from './element-templates.json';

insertCoreStyles();
insertBpmnStyles();

/**
 * Anything a user may interact with to modify a value.
 */
const EDITABLE_CONTROLS = [
  'input:not(:disabled)',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  '.bio-properties-panel-feel-icon:not(:disabled):not([title="FEEL expression is mandatory"])',
  '[contenteditable="true"]'
];

/**
 * Anything a user may click to trigger an action.
 */
const ACTIONS = [
  '.bio-properties-panel-add-entry',
  '.bio-properties-panel-remove-entry',
  '.bio-properties-panel-open-feel-popup',
  '.bio-properties-panel-open-popup',
  '.bio-properties-panel-drag-handle',
  '.bio-properties-panel-select-template-button',
  '.bio-properties-panel-applied-template-button',
  '.bio-properties-panel-template-not-found',
  '.bio-properties-panel-template-update-available',
  '.bio-properties-panel-template-incompatible',
  '.bio-properties-panel-deprecated-template-button',
  '.bio-properties-panel-group-entries button:not(:disabled)'
];

const FLAVORS = [
  {
    name: 'cloud-element-templates',
    diagram: cloudDiagram,
    templates: cloudTemplates,
    moddleExtensions: { zeebe: ZeebeModdle },
    viewerModules: [
      BpmnPropertiesProviderViewerModule,
      ZeebePropertiesProviderViewerModule,
      CloudElementTemplatesPropertiesProviderViewerModule
    ],
    editorModules: [
      BpmnPropertiesProviderModule,
      ZeebePropertiesProviderModule,
      CloudElementTemplatesPropertiesProviderModule
    ],
    coreViewerModule: CloudElementTemplatesCoreViewerModule
  },
  {
    name: 'element-templates',
    diagram: platformDiagram,
    templates: platformTemplates,
    moddleExtensions: { camunda: CamundaModdle },
    viewerModules: [
      BpmnPropertiesProviderViewerModule,
      CamundaPlatformPropertiesProviderViewerModule,
      ElementTemplatesPropertiesProviderViewerModule
    ],
    editorModules: [
      BpmnPropertiesProviderModule,
      CamundaPlatformPropertiesProviderModule,
      ElementTemplatesPropertiesProviderModule
    ],
    coreViewerModule: ElementTemplatesCoreViewerModule
  }
];


describe('viewer', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  afterEach(function() { return cleanup(); });


  FLAVORS.forEach(function(flavor) {

    const {
      name,
      diagram,
      templates,
      moddleExtensions,
      viewerModules,
      editorModules,
      coreViewerModule
    } = flavor;

    describe(name, function() {

      describe('modules', function() {

        let viewer;

        beforeEach(async function() {
          viewer = await createViewer(container, diagram, {
            moddleExtensions,
            elementTemplates: templates,
            modules: [
              BpmnPropertiesPanelViewerModule,
              ...viewerModules
            ]
          });
        });

        afterEach(function() { viewer.destroy(); });


        it('should not require editing services', function() {

          // then
          expect(viewer.get('propertiesPanel')).to.exist;
          expect(viewer.get('elementTemplates')).to.exist;

          expect(viewer.get('commandStack', false)).not.to.exist;
          expect(viewer.get('modeling', false)).not.to.exist;
          expect(viewer.get('bpmnFactory', false)).not.to.exist;
          expect(viewer.get('debounceInput', false)).not.to.exist;
          expect(viewer.get('elementTemplateCommands', false)).not.to.exist;
        });


        it('should load templates from config', function() {

          // when
          const elementTemplates = viewer.get('elementTemplates');

          // then
          expect(elementTemplates.get('viewer.all-types', 1)).to.exist;
          expect(elementTemplates.get('viewer.all-types', 2)).to.exist;
          expect(elementTemplates.getLatest('viewer.all-types')).to.have.length(1);
        });


        it('should resolve template of element', function() {

          // given
          const elementTemplates = viewer.get('elementTemplates'),
                elementRegistry = viewer.get('elementRegistry');

          // when
          const latest = elementTemplates.get(elementRegistry.get('AllTypes')),
                outdated = elementTemplates.get(elementRegistry.get('Outdated')),
                unknown = elementTemplates.get(elementRegistry.get('Unknown'));

          // then
          expect(latest.version).to.eql(2);
          expect(outdated.version).to.eql(1);
          expect(unknown).not.to.exist;
        });


        it('should not support editing templates', function() {

          // given
          const elementTemplates = viewer.get('elementTemplates'),
                element = viewer.get('elementRegistry').get('AllTypes'),
                template = elementTemplates.get(element);

          // then
          expect(() => elementTemplates.applyTemplate(element, template)).to.throw(/not available in a viewer/);
          expect(() => elementTemplates.removeTemplate(element)).to.throw(/not available in a viewer/);
          expect(() => elementTemplates.unlinkTemplate(element)).to.throw(/not available in a viewer/);
        });

      });


      describe('core module only', function() {

        let viewer;

        beforeEach(async function() {
          viewer = await createViewer(container, diagram, {
            moddleExtensions,
            elementTemplates: templates,
            modules: [ coreViewerModule ]
          });
        });

        afterEach(function() { viewer.destroy(); });


        it('should support template lookup', function() {

          // when
          const template = viewer.get('elementTemplates').get(viewer.get('elementRegistry').get('AllTypes'));

          // then
          expect(template).to.exist;
          expect(viewer.get('commandStack', false)).not.to.exist;
        });

      });


      describe('templates set via API', function() {

        let viewer, panelContainer;

        beforeEach(async function() {
          viewer = await createViewer(container, diagram, {
            moddleExtensions,
            modules: [
              BpmnPropertiesPanelViewerModule,
              ...viewerModules
            ]
          });

          panelContainer = await attachPanel(container, viewer);
        });

        afterEach(function() { viewer.destroy(); });


        it('should show templates', async function() {

          // given
          const selection = viewer.get('selection'),
                elementRegistry = viewer.get('elementRegistry');

          // assume
          await act(() => selection.select(elementRegistry.get('NoTemplate')));

          expect(domQuery('[data-group-id="group-ElementTemplates__Template"]', panelContainer)).not.to.exist;

          // when
          await act(() => viewer.get('elementTemplates').set(templates));
          await act(() => selection.select(elementRegistry.get('AllTypes')));
          await expandAll(panelContainer);

          // then
          expect(domQuery('[data-group-id="group-ElementTemplates__Template"]', panelContainer)).to.exist;
          expect(domQuery('[data-entry-id="template-name"]', panelContainer).textContent).to.contain('All property types');
          expect(domQuery('[data-group-id^="group-ElementTemplates__CustomProperties"]', panelContainer)).to.exist;
        });

      });


      describe('rendering', function() {

        let viewer, panelContainer, consoleError;

        beforeEach(async function() {
          consoleError = sinon.spy(console, 'error');

          viewer = await createViewer(container, diagram, {
            moddleExtensions,
            elementTemplates: templates,
            modules: [
              BpmnPropertiesPanelViewerModule,
              ...viewerModules
            ]
          });

          panelContainer = await attachPanel(container, viewer);
        });

        afterEach(function() {
          consoleError.restore();

          viewer.destroy();
        });


        it('should render every element read-only', async function() {

          // given
          const selection = viewer.get('selection'),
                elements = viewer.get('elementRegistry').filter(element => element.type !== 'label');

          expect(elements.length).to.be.above(6);

          let controlsCount = 0;

          // when
          for (const element of elements) {
            await act(() => selection.select(element));

            await expandAll(panelContainer);

            // then
            const id = element.id;

            expect(domQuery('.bio-properties-panel-group', panelContainer), `groups of <${id}>`).to.exist;

            expect(
              domQueryAll(EDITABLE_CONTROLS.join(', '), panelContainer),
              `editable controls of <${id}>`
            ).to.be.empty;

            expect(
              domQueryAll(ACTIONS.join(', '), panelContainer),
              `actions of <${id}>`
            ).to.be.empty;

            controlsCount += domQueryAll('input, textarea, select, .cm-content', panelContainer).length;
          }

          // assume we actually looked at entries
          expect(controlsCount).to.be.above(50);

          expect(consoleError).not.to.have.been.called;
        });


        it('should render template groups', async function() {

          // given
          const element = viewer.get('elementRegistry').get('AllTypes');

          // when
          await act(() => viewer.get('selection').select(element));
          await expandAll(panelContainer);

          // then
          const groupIds = getGroupIds(panelContainer);

          expect(groupIds).to.include('ElementTemplates__Template');
          expect(groupIds.some(id => id.startsWith('ElementTemplates__CustomProperties'))).to.be.true;

          // template details
          expect(domQuery('[data-entry-id="template-name"]', panelContainer).textContent).to.contain('All property types');
          expect(domQuery('[data-entry-id="template-version"]', panelContainer).textContent).to.contain('2');
        });


        it('should hide template actions', async function() {

          // given
          const selection = viewer.get('selection'),
                elementRegistry = viewer.get('elementRegistry');

          // when
          for (const id of [ 'AllTypes', 'Outdated', 'Unknown', 'Deprecated', 'NoTemplate' ]) {
            await act(() => selection.select(elementRegistry.get(id)));

            // then
            const header = domQuery('[data-group-id="group-ElementTemplates__Template"] .bio-properties-panel-group-header-buttons', panelContainer);

            expect(header, `template group of <${id}>`).to.exist;
            expect(domQueryAll('button:not(.bio-properties-panel-arrow)', header), `template actions of <${id}>`).to.be.empty;
          }
        });


        it('should render entries of outdated template', async function() {

          // given
          const element = viewer.get('elementRegistry').get('Outdated');

          // when
          await act(() => viewer.get('selection').select(element));

          // then
          expect(domQuery('[data-group-id="group-ElementTemplates__Template"]', panelContainer)).to.exist;
        });


        it('should render multiple selection', async function() {

          // given
          const elementRegistry = viewer.get('elementRegistry');

          // when
          await act(() => viewer.get('selection').select([
            elementRegistry.get('AllTypes'),
            elementRegistry.get('Unknown')
          ]));

          // then
          expect(domQuery('.bio-properties-panel-placeholder', panelContainer)).to.exist;
          expect(consoleError).not.to.have.been.called;
        });


        it('should respect <entriesVisible>', async function() {

          // given
          const selection = viewer.get('selection'),
                elementRegistry = viewer.get('elementRegistry');

          // when
          await act(() => selection.select(elementRegistry.get('AllTypes')));

          const visibleGroups = getGroupIds(panelContainer);

          await act(() => selection.select(elementRegistry.get('EntriesHidden')));

          const hiddenGroups = getGroupIds(panelContainer);

          // then
          expect(hiddenGroups.length).to.be.below(visibleGroups.length);
          expect(hiddenGroups).to.include('ElementTemplates__Template');
          expect(hiddenGroups).to.include('ElementTemplates__CustomProperties');
        });

      });


      describe('sanity check', function() {

        // assert that our selectors are not vacuous, that is they detect
        // controls and actions of an editable panel

        let modeler, panelContainer;

        beforeEach(async function() {
          modeler = new Modeler({
            container: container.appendChild(document.createElement('div')),
            additionalModules: [
              BpmnPropertiesPanelModule,
              ...editorModules
            ],
            moddleExtensions,
            elementTemplates: templates,
            debounceInput: false
          });

          await act(() => modeler.importXML(diagram));

          panelContainer = await attachPanel(container, modeler);
        });

        afterEach(function() { modeler.destroy(); });


        it('should detect editable controls and actions', async function() {

          // given
          const element = modeler.get('elementRegistry').get('AllTypes');

          // when
          await act(() => modeler.get('selection').select(element));
          await expandAll(panelContainer);

          // then
          expect(domQueryAll(EDITABLE_CONTROLS.join(', '), panelContainer).length).to.be.above(5);
          expect(domQueryAll(ACTIONS.join(', '), panelContainer).length).to.be.above(0);

          expect(domQuery('.bio-properties-panel-applied-template-button', panelContainer)).to.exist;
        });

      });

    });

  });


  describe('cloud-element-templates', function() {

    let viewer, panelContainer, consoleError;

    beforeEach(async function() {
      consoleError = sinon.spy(console, 'error');

      viewer = await createViewer(container, cloudDiagram, {
        moddleExtensions: { zeebe: ZeebeModdle },
        elementTemplates: cloudTemplates,
        modules: [
          BpmnPropertiesPanelViewerModule,
          BpmnPropertiesProviderViewerModule,
          ZeebePropertiesProviderViewerModule,
          CloudElementTemplatesPropertiesProviderViewerModule
        ]
      });

      panelContainer = await attachPanel(container, viewer);

      await act(() => viewer.get('selection').select(viewer.get('elementRegistry').get('AllTypes')));
      await expandAll(panelContainer);
    });

    afterEach(function() {
      consoleError.restore();

      viewer.destroy();
    });


    [
      [ 'String', 'basic-0', 'input[type="text"]:disabled' ],
      [ 'String (not editable)', 'basic-1', 'input[type="text"]:disabled' ],
      [ 'FEEL optional', 'basic-2', '.cm-content[contenteditable="false"]' ],
      [ 'FEEL required', 'basic-3', '.cm-content[contenteditable="false"]' ],
      [ 'Text', 'basic-4', 'textarea:disabled' ],
      [ 'FEEL Text', 'basic-5', '.cm-content[contenteditable="false"]' ],
      [ 'FEEL Text required', 'basic-6', '.cm-content[contenteditable="false"]' ],
      [ 'JSON', 'basic-7', '.cm-content[contenteditable="false"]' ],
      [ 'Number', 'advanced-0', 'input[type="number"]:disabled' ],
      [ 'Boolean', 'advanced-1', 'input[type="checkbox"]:disabled' ],
      [ 'Dropdown', 'advanced-2', 'select:disabled' ],
      [ 'Configuration', 'advanced-3', '.bio-properties-panel-configuration-chooser, .bio-properties-panel-configuration-chooser-card' ],
      [ 'conditional', 'advanced-4', 'input[type="text"]:disabled' ],
      [ 'ungrouped', '1', 'input[type="text"]:disabled' ]
    ].forEach(function([ type, suffix, control ]) {

      it('should render <' + type + '> property read-only', function() {

        // when
        const entry = domQuery(`[data-entry-id="custom-entry-viewer.all-types-${ suffix }"]`, panelContainer);

        // then
        expect(entry).to.exist;
        expect(domQuery(control, entry)).to.exist;

        expect(consoleError).not.to.have.been.called;
      });

    });


    it('should render configuration read-only', function() {

      // when
      const entry = domQuery('[data-entry-id="custom-entry-viewer.all-types-advanced-3"]', panelContainer);

      // then
      expect(domQueryAll('button:not(:disabled)', entry)).to.be.empty;
      expect(domQueryAll('button', entry)).not.to.be.empty;
    });


    it('should render selected configuration read-only', async function() {

      // given
      viewer.get('configurationInstances').setSelectableInstances([ {
        name: 'myConfiguration',
        metadata: {
          kind: 'CREDENTIAL',
          displayName: 'My configuration',
          configurationTemplate: 'viewer.configuration:1',
          configurationTemplateVersion: 1
        }
      } ]);

      // when
      await act(() => viewer.get('selection').select(viewer.get('elementRegistry').get('AllTypesEmpty')));
      await act(() => viewer.get('selection').select(viewer.get('elementRegistry').get('AllTypes')));
      await expandAll(panelContainer);

      // then
      const entry = domQuery('[data-entry-id="custom-entry-viewer.all-types-advanced-3"]', panelContainer);

      expect(entry.getAttribute('data-configuration-state')).to.eql('selected');

      expect(domQueryAll('button', entry)).not.to.be.empty;
      expect(domQueryAll('button:not(:disabled)', entry)).to.be.empty;

      expect(consoleError).not.to.have.been.called;
    });


    it('should render description and tooltip', function() {

      // when
      const entry = domQuery('[data-entry-id="custom-entry-viewer.all-types-basic-0"]', panelContainer);

      // then
      expect(domQuery('.bio-properties-panel-description a', entry)).to.exist;
      expect(domQuery('.bio-properties-panel-tooltip-wrapper', entry)).to.exist;
    });


    it('should render groups', function() {

      // then
      const groupIds = getGroupIds(panelContainer);

      expect(groupIds).to.include('ElementTemplates__CustomProperties-basic');
      expect(groupIds).to.include('ElementTemplates__CustomProperties-advanced');
      expect(groupIds).to.include('ElementTemplates__CustomProperties');
    });


    it('should apply conditions', function() {

      // then
      expect(domQuery('[data-entry-id="custom-entry-viewer.all-types-advanced-4"]', panelContainer)).to.exist;
      expect(domQuery('[data-entry-id="custom-entry-viewer.all-types-advanced-5"]', panelContainer)).not.to.exist;
    });

  });

  describe('element-templates', function() {

    let viewer, panelContainer, consoleError;

    beforeEach(async function() {
      consoleError = sinon.spy(console, 'error');

      viewer = await createViewer(container, platformDiagram, {
        moddleExtensions: { camunda: CamundaModdle },
        elementTemplates: platformTemplates,
        modules: [
          BpmnPropertiesPanelViewerModule,
          BpmnPropertiesProviderViewerModule,
          CamundaPlatformPropertiesProviderViewerModule,
          ElementTemplatesPropertiesProviderViewerModule
        ]
      });

      panelContainer = await attachPanel(container, viewer);

      await act(() => viewer.get('selection').select(viewer.get('elementRegistry').get('AllTypes')));
      await expandAll(panelContainer);
    });

    afterEach(function() {
      consoleError.restore();

      viewer.destroy();
    });


    it('should render custom properties read-only', function() {

      // then
      expect(domQueryAll('[data-group-id^="group-ElementTemplates__CustomProperties"]', panelContainer)).to.have.length(3);

      expect(domQueryAll('input[type="text"]:disabled', panelContainer)).not.to.be.empty;
      expect(domQueryAll('textarea:disabled', panelContainer)).not.to.be.empty;
      expect(domQueryAll('input[type="checkbox"]:disabled', panelContainer)).not.to.be.empty;
      expect(domQueryAll('select:disabled', panelContainer)).not.to.be.empty;

      expect(consoleError).not.to.have.been.called;
    });


    it('should render input, output and error lists read-only', function() {

      // then
      const groupIds = getGroupIds(panelContainer);

      expect(groupIds).to.include.members([
        'ElementTemplates__Input',
        'ElementTemplates__Output',
        'ElementTemplates__Error'
      ]);

      expect(domQueryAll('.bio-properties-panel-collapsible-entry', panelContainer)).not.to.be.empty;
      expect(domQueryAll('.bio-properties-panel-add-entry, .bio-properties-panel-remove-entry', panelContainer)).to.be.empty;
    });

  });

});


describe('viewer (loading)', function() {

  let container, viewer, consoleError;

  beforeEach(function() {
    container = TestContainer.get(this);

    consoleError = sinon.spy(console, 'error');
  });

  afterEach(function() {
    consoleError.restore();

    viewer && viewer.destroy();
  });


  describe('validation', function() {

    FLAVORS.forEach(function({ name, diagram, moddleExtensions, viewerModules, templates }) {

      it(`should not report invalid templates (${ name })`, async function() {

        // given
        const onErrors = sinon.spy(),
              onWarnings = sinon.spy();

        const broken = [
          { id: 'broken' },
          { $schema: 'foo', name: 'No ID' }
        ];

        // when
        viewer = await createViewer(container, diagram, {
          moddleExtensions,
          elementTemplates: [ ...templates, ...broken ],
          modules: [
            BpmnPropertiesPanelViewerModule,
            ...viewerModules,
            {
              __init__: [ function(eventBus) {
                eventBus.on('elementTemplates.errors', onErrors);
                eventBus.on('elementTemplates.warnings', onWarnings);
              } ]
            }
          ]
        });

        // then
        expect(onErrors).not.to.have.been.called;
        expect(onWarnings).not.to.have.been.called;
        expect(consoleError).not.to.have.been.called;

        // but malformed templates are not made available
        const elementTemplates = viewer.get('elementTemplates');

        expect(elementTemplates.getLatest('broken') || []).to.be.empty;
        expect(elementTemplates.getLatest('viewer.all-types')).to.have.length(1);
      });

    });

  });


  describe('icons', function() {

    const ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" fill="red"/></svg>'
    );

    it('should render element template icons', async function() {

      // given
      const diagram = cloudDiagram.replace(
        'id="AllTypes"',
        `id="AllTypes" zeebe:modelerTemplateIcon="${ ICON }"`
      );

      // when
      viewer = await createViewer(container, diagram, {
        moddleExtensions: { zeebe: ZeebeModdle },
        elementTemplates: cloudTemplates,
        modules: [
          ElementTemplatesIconsRenderer,
          BpmnPropertiesPanelViewerModule,
          BpmnPropertiesProviderViewerModule,
          ZeebePropertiesProviderViewerModule,
          CloudElementTemplatesPropertiesProviderViewerModule
        ]
      });

      // then
      const gfx = viewer.get('elementRegistry').getGraphics('AllTypes');

      const image = domQuery('image', gfx);

      expect(image).to.exist;
      expect(image.getAttribute('href')).to.eql(ICON);
    });

  });

});


// helpers //////////

/**
 * @param {HTMLElement} container
 * @param {string} diagram
 * @param {Object} options
 * @param {Array} options.modules
 *
 * @return {Promise<NavigatedViewer>}
 */
async function createViewer(container, diagram, { modules, ...options }) {
  const viewerContainer = document.createElement('div');
  viewerContainer.style.height = '300px';

  container.appendChild(viewerContainer);

  const viewer = new NavigatedViewer({
    container: viewerContainer,
    additionalModules: modules,
    ...options
  });

  await act(() => viewer.importXML(diagram));

  return viewer;
}

async function attachPanel(container, viewer) {
  const panelContainer = document.createElement('div');
  container.appendChild(panelContainer);

  await act(() => viewer.get('propertiesPanel').attachTo(panelContainer));

  return panelContainer;
}

/**
 * Expand all groups and list items, so that their entries are rendered.
 */
async function expandAll(panelContainer) {
  const selector = '.bio-properties-panel-group-header:not(.open), .bio-properties-panel-collapsible-entry-header:not(.open)';

  // groups first, list items second
  for (let i = 0; i < 2; i++) {
    for (const header of domQueryAll(selector, panelContainer)) {
      await act(() => header.click());
    }
  }
}

function getGroupIds(panelContainer) {
  return Array.from(domQueryAll('[data-group-id]', panelContainer))
    .map(group => group.getAttribute('data-group-id').replace(/^group-/, ''));
}
