import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { SelectEntry } from '@bpmn-io/properties-panel';
import { propertyGetter, propertySetter, propertyValidator } from './util';

export function DropdownProperty(props) {
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
        commandStack = useService('commandStack'),
        translate = useService('translate');

  const getOptions = () => {
    const { choices, optional } = property;
    let dropdownOptions = [];

    dropdownOptions = choices.map(({ name, value }) => {
      return {
        label: name,
        value
      };
    });

    if (optional) {
      dropdownOptions = [ { label: '', value: undefined }, ...dropdownOptions ];
    }

    return dropdownOptions;
  };

  return SelectEntry({
    element,
    id,
    label,
    getOptions,
    description: PropertyDescription({ description }),
    getValue: propertyGetter(element, property),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    validate: propertyValidator(translate, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
