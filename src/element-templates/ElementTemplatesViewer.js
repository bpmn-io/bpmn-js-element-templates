import ElementTemplates from './ElementTemplates';

import { disableMethods } from '../utils/viewerUtil';

/**
 * Read-only {@link ElementTemplates}, for use in a viewer. Supports
 * looking up templates, but does not require any editing features
 * and cannot apply, remove or unlink templates.
 */
export default class ElementTemplatesViewer extends ElementTemplates {
  constructor(eventBus, injector, config) {
    super(null, eventBus, null, injector, config);
  }
}

disableMethods(ElementTemplatesViewer, [
  'applyTemplate',
  'removeTemplate',
  'unlinkTemplate'
]);

ElementTemplatesViewer.$inject = [
  'eventBus',
  'injector',
  'config.elementTemplates'
];
