import Markup from 'preact-markup';

import { sanitizeHTML } from '../utils/sanitize';

export function PropertyDescription(props) {

  const {
    description
  } = props;

  return description && (
    <Markup
      markup={ sanitizeHTML(description) }
      trim={ false } />
  );
}