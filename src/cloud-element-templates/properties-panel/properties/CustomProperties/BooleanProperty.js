import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { CheckboxEntry } from '@bpmn-io/properties-panel';
import { propertyGetter, propertySetter } from './util';

export function BooleanProperty(props) {
  const {
    element,
    id,
    property
  } = props;

  const {
    description,
    editable,
    label,
    tooltip
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack');

  return CheckboxEntry({
    element,
    getValue: propertyGetter(element, property),
    id,
    label,
    description: PropertyDescription({ description }),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
