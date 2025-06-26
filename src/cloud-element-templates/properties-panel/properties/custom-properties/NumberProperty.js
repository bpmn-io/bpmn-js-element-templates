import { FeelNumberEntry, NumberFieldEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { propertyValidator, usePropertyAccessors } from './util';
import { shouldCastToFeel } from '../../../util/FeelUtil';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { useCallback } from '@bpmn-io/properties-panel/preact/hooks';
import { isNumber } from 'min-dash';

export function NumberProperty(props) {
  const {
    element,
    id,
    property
  } = props;

  const {
    description,
    editable,
    label,
    feel,
    tooltip
  } = property;

  const Component = feel === 'optional' ? FeelNumberEntry : NumberFieldEntry;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput'),
        translate = useService('translate');

  const [ getValue, setValue ] = usePropertyAccessors(bpmnFactory, commandStack, element, property);

  const validate = useCallback((value) => {
    if (shouldCastToFeel(property) && isNumber(value) && value.toString().includes('e')) {
      return translate('Scientific notation is disallowed in FEEL.');
    }

    const defaultValidator = propertyValidator(translate, property);
    return defaultValidator(value);
  }, [ translate, property ]);

  return Component({
    debounce,
    element,
    getValue,
    step: 'any',
    id,
    label,
    description: PropertyDescription({ description }),
    setValue,
    validate: validate,
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
