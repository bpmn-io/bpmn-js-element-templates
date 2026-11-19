import ElementTemplatesViewer from '../ElementTemplatesViewer';
import ElementTemplatesLoader from '../ElementTemplatesViewerLoader';

export default {
  __init__: [
    'elementTemplatesLoader'
  ],
  elementTemplates: [ 'type', ElementTemplatesViewer ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ]
};
