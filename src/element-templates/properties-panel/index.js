import translateModule from 'diagram-js/lib/i18n/translate';

import ElementTemplatesPropertiesProvider from './ElementTemplatesPropertiesProvider';

import { CamundaPlatformPropertiesProviderModule } from 'bpmn-js-properties-panel';

export default {
  __depends__: [
    translateModule,
    CamundaPlatformPropertiesProviderModule
  ],
  __init__: [
    'elementTemplatesPropertiesProvider'
  ],
  elementTemplatesPropertiesProvider: [ 'type', ElementTemplatesPropertiesProvider ]
};
