import ElementTemplates from '../ElementTemplates';
import ElementTemplatesLoader from '../ElementTemplatesLoader';

import commandsModule from '../cmd';
import behaviorModule from '../behavior';

export default {
  __depends__: [
    commandsModule,
    behaviorModule
  ],
  __init__: [
    'elementTemplatesLoader'
  ],
  elementTemplates: [ 'type', ElementTemplates ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ]
};
