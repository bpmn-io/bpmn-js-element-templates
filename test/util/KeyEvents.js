import {
  assign,
  isString,
  omit
} from 'min-dash';

/**
 * Create a fake key event for testing purposes.
 *
 * @param {String|number} key the key or keyCode/charCode
 * @param {Object} [attrs]
 * @param {string} [attrs.type]
 *
 * @return {Event}
 */
export function createKeyEvent(key, attrs) {
  if (!attrs) {
    attrs = {};
  }

  var event = document.createEvent('Events') || new document.defaultView.CustomEvent('keyEvent');

  // init and mark as bubbles / cancelable
  event.initEvent(attrs.type || 'keydown', false, true);

  var keyAttrs = isString(key) ? { key: key } : { keyCode: key, which: key };

  return assign(event, keyAttrs, omit(attrs, [ 'type' ]));
}