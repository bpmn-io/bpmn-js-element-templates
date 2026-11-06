import ElementTemplatesViewer from '../ElementTemplatesViewer';
import ElementTemplatesLoader from '../ElementTemplatesViewerLoader';
import ConfigurationInstances from './ConfigurationInstances';
import ConfigurationTemplates from './ConfigurationTemplates';

export default {
  __init__: [
    'elementTemplatesLoader',
    'configurationTemplates'
  ],
  elementTemplates: [ 'type', ElementTemplatesViewer ],
  elementTemplatesLoader: [ 'type', ElementTemplatesLoader ],
  configurationInstances: [ 'type', ConfigurationInstances ],
  configurationTemplates: [ 'type', ConfigurationTemplates ]
};
