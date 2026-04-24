import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { JsonEditorEntry } from '@bpmn-io/properties-panel';
import {
  propertyGetter,
  propertySetter
} from './util';

export function JsonEditorProperty(props) {
  const {
    element,
    id,
    property
  } = props;

  const {
    description,
    editable,
    label,
    placeholder,
    tooltip
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput');

  return JsonEditorEntry({
    debounce,
    element,
    id,
    label,
    placeholder,
    description: PropertyDescription({ description }),
    getValue: propertyGetter(element, property),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
