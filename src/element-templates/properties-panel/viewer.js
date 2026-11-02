import translateModule from 'diagram-js/lib/i18n/translate';

import ElementTemplatesPropertiesProvider from './ElementTemplatesPropertiesProvider';

import { CamundaPlatformPropertiesProviderViewerModule } from 'bpmn-js-properties-panel';

/**
 * Read-only variant of the properties provider, to be used with a viewer.
 * Reuses the editor provider, which renders read-only in a viewer panel.
 */
export default {
  __depends__: [
    translateModule,
    CamundaPlatformPropertiesProviderViewerModule
  ],
  __init__: [
    'elementTemplatesPropertiesProvider'
  ],
  elementTemplatesPropertiesProvider: [ 'type', ElementTemplatesPropertiesProvider ]
};
