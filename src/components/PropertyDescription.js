import Markup from 'preact-markup';
import { useService } from 'bpmn-js-properties-panel';

import { sanitizeHTML } from '../utils/sanitize';

export function PropertyDescription(props) {
  const {
    description
  } = props;

  const translate = useService('translate');

  return description && (
    <Markup
      markup={ sanitizeHTML(translate(description)) }
      trim={ false } />
  );
}