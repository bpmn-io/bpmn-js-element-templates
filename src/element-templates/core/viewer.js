import ElementTemplatesViewer from '../ElementTemplatesViewer';
import ElementTemplatesLoader from '../ElementTemplatesLoader';

export default {
  __init__: [
    'elementTemplatesLoader'
  ],
  elementTemplates: [ 'type', ElementTemplatesViewer ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ]
};
