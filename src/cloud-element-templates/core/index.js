import ElementTemplates from '../ElementTemplates';
import ElementTemplatesLoader from '../ElementTemplatesLoader';
import ConfigurationInstances from './ConfigurationInstances';
import ConfigurationTemplates from './ConfigurationTemplates';

import commandsModule from '../cmd';
import createModule from '../create';
import behaviorModule from '../behavior';

export default {
  __depends__: [
    commandsModule,
    behaviorModule,
    createModule
  ],
  __init__: [
    'elementTemplatesLoader',
    'configurationTemplates'
  ],
  elementTemplates: [ 'type', ElementTemplates ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ],
  configurationInstances: [ 'type', ConfigurationInstances ],
  configurationTemplates: [ 'type', ConfigurationTemplates ]
};
