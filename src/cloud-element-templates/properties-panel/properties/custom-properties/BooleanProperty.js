import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { CheckboxEntry, FeelCheckboxEntry } from '@bpmn-io/properties-panel';
import { usePropertyAccessors } from './util';

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
    tooltip,
    feel
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput'),
        translate = useService('translate');

  const Component = feel === 'optional' ? FeelCheckboxEntry : CheckboxEntry;

  const [ getValue, setValue ] = usePropertyAccessors(bpmnFactory, commandStack, element, property);

  return Component({
    element,
    debounce,
    translate,
    getValue,
    id,
    label,
    description: PropertyDescription({ description }),
    setValue,
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
