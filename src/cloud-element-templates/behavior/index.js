import ConditionalBehavior from './ConditionalBehavior';
import ConditionalEventTemplateBehavior from './ConditionalEventTemplateBehavior';
import ReplaceBehavior from './ReplaceBehavior';
import TimerTemplateBehavior from './TimerTemplateBehavior';
import UpdatePropertiesOrderBehavior from './UpdatePropertiesOrderBehavior';
import { ReferencedElementBehavior } from './ReferencedElementBehavior';
import { GeneratedValueBehavior } from './GeneratedValueBehavior';
import { CalledElementBehavior } from './CalledElementBehavior';
import UserTaskBehavior from './UserTaskBehavior';
import UpdatePathsBehavior from './UpdatePathsBehavior';

export default {
  __init__: [
    'elementTemplatesReplaceBehavior',
    'elementTemplatesConditionalBehavior',
    'elementTemplatesConditionalEventTemplateBehavior',
    'elementTemplatesGeneratedValueBehavior',
    'elementTemplatesReferencedElementBehavior',
    'elementTemplatesUpdatePropertiesOrderBehavior',
    'elementTemplatesCalledElementBehavior',
    'elementTemplatesUserTaskBehavior',
    'elementTemplatesTimerTemplateBehavior',
    'elementTemplatesUpdatePathsBehavior'
  ],
  elementTemplatesReplaceBehavior: [ 'type', ReplaceBehavior ],
  elementTemplatesConditionalBehavior: [ 'type', ConditionalBehavior ],
  elementTemplatesConditionalEventTemplateBehavior: [ 'type', ConditionalEventTemplateBehavior ],
  elementTemplatesGeneratedValueBehavior: [ 'type', GeneratedValueBehavior ],
  elementTemplatesReferencedElementBehavior: [ 'type', ReferencedElementBehavior ],
  elementTemplatesUpdatePropertiesOrderBehavior: [ 'type', UpdatePropertiesOrderBehavior ],
  elementTemplatesCalledElementBehavior: [ 'type', CalledElementBehavior ],
  elementTemplatesUserTaskBehavior: [ 'type', UserTaskBehavior ],
  elementTemplatesTimerTemplateBehavior: [ 'type', TimerTemplateBehavior ],
  elementTemplatesUpdatePathsBehavior: [ 'type', UpdatePathsBehavior ]
};
