import ElementTemplatesLoader from './ElementTemplatesLoader';

/**
 * Template loader for viewers.
 *
 * Templates are still checked, so that malformed ones never reach
 * the properties panel, but nothing is reported: a viewer does not
 * surface template errors or warnings.
 */
export default class ElementTemplatesViewerLoader extends ElementTemplatesLoader {

  _templateErrors() {}

  _templateWarnings() {}
}

ElementTemplatesViewerLoader.$inject = [
  'config.elementTemplates',
  'eventBus',
  'elementTemplates',
  'moddle'
];
