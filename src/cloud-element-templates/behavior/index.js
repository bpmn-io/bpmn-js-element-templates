import ConditionalBehavior from './ConditionalBehavior';
import ReplaceBehavior from './ReplaceBehavior';
import UpdatePropertiesOrderBehavior from './UpdatePropertiesOrderBehavior';
import { ReferencedElementBehavior } from './ReferencedElementBehavior';
import { GeneratedValueBehavior } from './GeneratedValueBehavior';
import { CalledElementBehavior } from './CalledElementBehavior';

export default {
  __init__: [
    'elementTemplatesReplaceBehavior',
    'elementTemplatesConditionalBehavior',
    'elementTemplatesGeneratedValueBehavior',
    'elementTemplatesReferencedElementBehavior',
    'elementTemplatesUpdatePropertiesOrderBehavior',
    'elementTemplatesCalledElementBehavior'
  ],
  elementTemplatesReplaceBehavior: [ 'type', ReplaceBehavior ],
  elementTemplatesConditionalBehavior: [ 'type', ConditionalBehavior ],
  elementTemplatesGeneratedValueBehavior: [ 'type', GeneratedValueBehavior ],
  elementTemplatesReferencedElementBehavior: [ 'type', ReferencedElementBehavior ],
  elementTemplatesUpdatePropertiesOrderBehavior: [ 'type', UpdatePropertiesOrderBehavior ],
  elementTemplatesCalledElementBehavior: [ 'type', CalledElementBehavior ]
};
