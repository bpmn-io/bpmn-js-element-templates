import coreViewerModule from './core/viewer';
import propertiesProviderViewerModule from './properties-panel/viewer';

export default {
  __depends__: [
    coreViewerModule,
    propertiesProviderViewerModule
  ]
};
