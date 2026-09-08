import coreModule from './core';
import propertiesProviderModule from './properties-panel';
import contextPadModule from 'bpmn-js/lib/features/context-pad';

export default {
  __depends__: [
    coreModule,
    propertiesProviderModule,
    contextPadModule
  ]
};
