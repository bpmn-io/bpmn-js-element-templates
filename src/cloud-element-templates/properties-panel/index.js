import translateModule from 'diagram-js/lib/i18n/translate';

import ElementTemplatesPropertiesProvider from './ElementTemplatesPropertiesProvider';

export default {
  __depends__: [
    translateModule
  ],
  __init__: [
    'elementTemplatesPropertiesProvider'
  ],
  elementTemplatesPropertiesProvider: [ 'type', ElementTemplatesPropertiesProvider ]
};
