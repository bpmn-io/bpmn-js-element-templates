import ElementTemplates from './ElementTemplates';

import { disableMethods } from '../utils/viewerUtil';

/**
 * Read-only {@link ElementTemplates}, for use in a viewer. Supports
 * looking up templates, but does not require any editing features
 * and cannot create elements, or apply, remove or unlink templates.
 */
export default class ElementTemplatesViewer extends ElementTemplates {
  constructor(eventBus, injector, translate, config) {
    super(null, null, eventBus, null, injector, translate, config);
  }
}

disableMethods(ElementTemplatesViewer, [
  'applyTemplate',
  'createElement',
  'removeTemplate',
  'setPropertyValue',
  'unlinkTemplate'
]);

ElementTemplatesViewer.$inject = [
  'eventBus',
  'injector',
  'translate',
  'config.elementTemplates'
];
