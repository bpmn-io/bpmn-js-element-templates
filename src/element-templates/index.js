import coreModule from './core';
import propertiesProviderModule from './properties-panel';

export default {
  __depends__: [
    coreModule,
    propertiesProviderModule,
  ]
};
