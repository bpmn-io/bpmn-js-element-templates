import coreModule from './core';
import propertiesProviderModule from './properties-panel';
import popupMenuModule from 'bpmn-js/lib/features/popup-menu';

export default {
  __depends__: [
    coreModule,
    propertiesProviderModule,
    popupMenuModule
  ]
};
