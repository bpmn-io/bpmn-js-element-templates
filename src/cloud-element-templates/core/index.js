import ElementTemplates from '../ElementTemplates';
import ElementTemplatesLoader from '../ElementTemplatesLoader';

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
    'elementTemplatesLoader'
  ],
  elementTemplates: [ 'type', ElementTemplates ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ]
};
