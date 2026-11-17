import TestContainer from 'mocha-test-container-support';

import { domify } from 'min-dom';

import Modeler from 'bpmn-js/lib/Modeler';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';

import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

import {
  insertBpmnStyles,
  insertCoreStyles,
  insertCSS,
  setBpmnJS
} from 'test/TestHelper';

import CloudElementTemplatesModule from 'src/cloud-element-templates';

import diagramXML from './diagram.bpmn';
import templates from './templates.json';

const singleStart = window.__env__ && window.__env__.SINGLE_START;

insertCoreStyles();
insertBpmnStyles();

insertCSS('migration-example.css', `
  .migration-example {
    display: flex;
    flex-direction: column;
    --example-properties-width: 400px;
  }

  .migration-example .bjs-container {
    padding-right: var(--example-properties-width);
  }

  .migration-example .properties-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--example-properties-width);
    height: 100%;
    border-left: solid 1px #ccc;
    background-color: #f7f7f8;
  }

  .migration-modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    font-family: sans-serif;
    z-index: 100;
  }

  .migration-modal .dialog {
    width: 420px;
    padding: 20px;
    background: white;
    border-radius: 4px;
  }

  .migration-modal .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`);


/**
 * Run with `npm run start:migration`.
 */
(singleStart === 'migration' ? describe.only : describe.skip)('migration (demo)', function() {

  this.timeout(0);

  it('should review migration', async function() {

    // given
    const container = TestContainer.get(this);

    container.classList.add('migration-example');

    const modelerContainer = domify('<div class="modeler-container"></div>');

    container.appendChild(modelerContainer);

    const modeler = new Modeler({
      container: modelerContainer,
      additionalModules: [
        ZeebeBehaviorsModule,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ZeebePropertiesProviderModule,
        CloudElementTemplatesModule
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle
      },
      elementTemplates: templates
    });

    const propertiesPanelContainer = domify('<div class="properties-panel-container"></div>');

    modeler.get('canvas').getContainer().parentNode.appendChild(propertiesPanelContainer);

    modeler.get('propertiesPanel').attachTo(propertiesPanelContainer);

    setBpmnJS(modeler);

    await modeler.importXML(diagramXML);

    // when
    embedChangesReview(modeler);
  });

});


/**
 * Application: show changes on review request.
 */
function embedChangesReview(modeler) {
  const elementTemplates = modeler.get('elementTemplates'),
        eventBus = modeler.get('eventBus');

  eventBus.on('elementTemplates.reviewChanges', ({ element, newTemplate, changes }) => {
    openModal({
      from: elementTemplates.get(element),
      to: newTemplate,
      changes,
      migrate: () => elementTemplates.applyTemplate(element, newTemplate)
    });
  });
}

function openModal({ from, to, changes, migrate }) {
  const modal = domify(`
    <div class="migration-modal">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="migration-title">
        <h3 id="migration-title"></h3>
        <div class="changes"></div>
        <div class="actions">
          <button class="cancel">Cancel</button>
          <button class="migrate">Migrate</button>
        </div>
      </div>
    </div>
  `);

  modal.querySelector('h3').textContent = `Migrate from ${ from.name } to ${ to.name }`;

  modal.querySelector('.changes').innerHTML = renderMarkdown(changes || 'No changes described.');

  const close = () => modal.remove();

  modal.querySelector('.cancel').addEventListener('click', close);

  modal.querySelector('.migrate').addEventListener('click', () => {
    migrate();
    close();
  });

  modal.addEventListener('keydown', event => event.key === 'Escape' && close());

  document.body.appendChild(modal);

  modal.querySelector('.migrate').focus();
}

/**
 * Render escaped paragraphs, lists, and links.
 */
function renderMarkdown(text) {
  const escape = str => str.replace(/[&<>"']/g, c => `&#${ c.charCodeAt(0) };`);

  const inline = str => escape(str).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  return text.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');

    if (lines.every(line => line.startsWith('- '))) {
      return `<ul>${ lines.map(line => `<li>${ inline(line.slice(2)) }</li>`).join('') }</ul>`;
    }

    return `<p>${ inline(block) }</p>`;
  }).join('');
}
