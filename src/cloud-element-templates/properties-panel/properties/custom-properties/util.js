import { find, groupBy } from 'min-dash';
import { getPropertyValue, setPropertyValue, validateProperty } from '../../../util/propertyUtil';
import { shouldCastToFeel, toFeelExpression } from '../../../util/FeelUtil';

import { useCallback, useState } from '@bpmn-io/properties-panel/preact/hooks';

export function usePropertyAccessors(bpmnFactory, commandStack, element, property) {
  const directSet = useCallback(propertySetter(bpmnFactory, commandStack, element, property), [ bpmnFactory, commandStack, element, property ]);
  const directGet = useCallback(propertyGetter(element, property), [ element, property ]);

  const [ isFeelEnabled, setIsFeelEnabled ] = useState(feelEnabled(property, directGet()));

  const handleFeelToggle = useCallback((value) => {
    if (!isFeelEnabled && typeof value === 'string' && value.startsWith('=')) {
      setIsFeelEnabled(true);
    }

    if (isFeelEnabled && (typeof value !== 'string' || !value.startsWith('='))) {
      setIsFeelEnabled(false);
    }
  }, [ isFeelEnabled ]);

  const set = useCallback((value, error) => {
    handleFeelToggle(value);
    directSet(toFeelExpression(value, property.type));
  }, [ directSet, property, handleFeelToggle ]);

  const get = useCallback(() => {
    if (isFeelEnabled) {
      return directGet();
    }

    return fromFeelExpression(directGet(), property.type);
  }, [ directGet, property, isFeelEnabled ]);

  if (!shouldCastToFeel(property)) {
    return [ directGet, directSet ];
  }

  return [ get, set ];
}


const fromFeelExpression = (value, type) => {
  if (typeof value === 'undefined') {
    return value;
  }

  if (typeof value === 'string' && value.startsWith('=')) {
    value = value.slice(1);
  }

  if (type === 'Number') {
    return Number(value);
  }

  if (type === 'Boolean') {
    return value !== 'false';
  }

  return value;
};

const feelEnabled = (property, value) => {
  if (!shouldCastToFeel(property)) {
    return true;
  }

  if (property.type === 'Boolean') {
    return !(value === '=true' || value === '=false');
  }

  if (property.type === 'Number') {
    return isNaN(fromFeelExpression(value, property.type));
  }

  return true;
};


export function propertyGetter(element, property) {
  return function getValue() {
    return getPropertyValue(element, property);
  };
}

export function propertySetter(bpmnFactory, commandStack, element, property) {
  return function setValue(value) {
    return setPropertyValue(bpmnFactory, commandStack, element, property, value);
  };
}

export function propertyValidator(translate, property) {
  return value => validateProperty(value, property, translate);
}

export function groupByGroupId(properties) {
  return groupBy(properties, 'group');
}

export function findCustomGroup(groups, id) {
  return find(groups, g => g.id === id);
}

/**
 * Is the given property executed by the engine?
 *
 * @param { { binding: { type: string } } } property
 * @return {boolean}
 */
export function isExternalProperty(property) {
  return [ 'zeebe:property', 'zeebe:taskHeader' ].includes(property.binding.type);
}
