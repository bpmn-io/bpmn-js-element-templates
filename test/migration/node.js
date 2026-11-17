import Modeler from 'bpmn-js-headless/lib/Modeler';
import { CloudElementTemplatesCoreModule } from '../../src/core';
import ZeebeModdleExtension from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { configure } from './helper';
import './upstream';
import './parity';
configure({
  Modeler,
  CloudElementTemplatesCoreModule,
  ZeebeModdleExtension,
  HeadlessTextRendererModule: {
    textRenderer: [ 'value', {
      getExternalLabelBounds(bounds) {
        return bounds;
      },
      getTextAnnotationBounds(bounds) {
        return bounds;
      },
      getDimensions() {
        return {
          width: 0,
          height: 0
        };
      },
      createText() {
        return null;
      }
    } ]
  }
});
