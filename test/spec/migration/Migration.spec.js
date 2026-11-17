import Modeler from 'bpmn-js/lib/Modeler';
import { CloudElementTemplatesCoreModule } from '../../../src/core';
import ZeebeModdleExtension from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { configure } from '../../migration/helper';
import '../../migration/upstream';
import '../../migration/parity';

configure({
  Modeler,
  CloudElementTemplatesCoreModule,
  ZeebeModdleExtension,
  HeadlessTextRendererModule: {}
});
