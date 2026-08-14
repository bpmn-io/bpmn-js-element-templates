import { useCallback, useEffect, useRef, useState } from '@bpmn-io/properties-panel/preact/hooks';

/**
 * Manage an open/closed popup (e.g. a popover or menu) together with the focus
 * choreography that keyboard accessibility requires. Unlike a plain ARIA
 * disclosure, a popup moves focus into the layer on open and must return it to
 * the trigger on close.
 *
 * Distinguishes two ways of closing:
 *
 * - `close()` closes and returns focus to the trigger (keyboard-driven close,
 *   e.g. Escape or activating an item). The refocus is deferred until the
 *   trigger is available again, since the trigger may be a freshly rendered
 *   element (e.g. a card that replaces a placeholder once the model change has
 *   propagated).
 * - `dismiss()` closes without moving focus, letting focus continue to its
 *   natural destination (e.g. focus leaving the popup, or an outside click).
 *
 * `show(payload)`/`toggle(payload)` carry an opaque payload describing the
 * open intent (e.g. which end of a menu to focus); it is exposed as `payload`
 * while open and reset on close.
 *
 * @param {Object} [options]
 * @param {() => (HTMLElement|null)} [options.resolveReturnFocus] resolve the
 * element that focus should return to after a `close()`
 *
 * @returns {{
 *   open: boolean,
 *   payload: any,
 *   show: (payload?: any) => void,
 *   toggle: (payload?: any) => void,
 *   close: () => void,
 *   dismiss: () => void
 * }}
 */
export function usePopup(options = {}) {
  const { resolveReturnFocus } = options;

  const [ state, setState ] = useState({ open: false, payload: undefined });

  const pendingFocusRef = useRef(false);

  const show = useCallback((payload) => {
    setState({ open: true, payload });
  }, []);

  const toggle = useCallback((payload) => {
    setState(state => state.open
      ? { open: false, payload: undefined }
      : { open: true, payload });
  }, []);

  const dismiss = useCallback(() => {
    setState({ open: false, payload: undefined });
  }, []);

  const close = useCallback(() => {
    pendingFocusRef.current = true;
    setState({ open: false, payload: undefined });
  }, []);

  // return focus to the trigger once closed; retried across renders until the
  // trigger is available, hence the unconditional (dependency-free) effect
  useEffect(() => {
    if (state.open || !pendingFocusRef.current) {
      return;
    }

    const target = resolveReturnFocus && resolveReturnFocus();

    if (target) {
      target.focus();
      pendingFocusRef.current = false;
    }
  });

  return {
    open: state.open,
    payload: state.payload,
    show,
    toggle,
    close,
    dismiss
  };
}

/**
 * Manage the active index of a keyboard-navigable list of options (e.g. a
 * listbox or menu). Owns the index, keeps it within bounds as the list size
 * changes, and returns a key handler for the arrow/Home/End navigation keys.
 *
 * The caller decides how the active index is reflected (aria-activedescendant
 * vs. roving focus) and how activation keys (Enter/Space/Escape) are handled.
 *
 * @param {number} count number of options
 * @param {Object} [options]
 * @param {number} [options.initialIndex=0]
 * @param {boolean} [options.wrap=false] wrap around at the list boundaries
 *
 * @returns {[ number, (index: number) => void, (event: KeyboardEvent) => void ]}
 */
export function useActiveIndex(count, options = {}) {
  const { initialIndex = 0, wrap = false } = options;

  const [ activeIndex, setActiveIndex ] = useState(initialIndex);

  // keep the active index within bounds as the list changes
  useEffect(() => {
    setActiveIndex(index => clamp(index, count));
  }, [ count ]);

  const onKeyDown = useCallback((event) => {
    const { key } = event;

    if (key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => step(index, 1, count, wrap));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => step(index, -1, count, wrap));
    } else if (key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (key === 'End') {
      event.preventDefault();
      setActiveIndex(count - 1);
    }
  }, [ count, wrap ]);

  return [ activeIndex, setActiveIndex, onKeyDown ];
}

/**
 * Invoke a handler once focus leaves the referenced element entirely (e.g.
 * tabbing to the next field), letting focus continue to its natural
 * destination.
 *
 * We attach a native `focusout` listener (which bubbles) rather than relying on
 * preact's synthetic onFocusOut, which does not reliably fire for bubbled focus
 * events.
 *
 * @param {{ current: HTMLElement }} ref
 * @param {() => void} handler stable callback (e.g. via useCallback)
 */
export function useFocusOut(ref, handler) {
  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const onFocusOut = (event) => {
      const next = event.relatedTarget || document.activeElement;

      if (!node.contains(next)) {
        handler();
      }
    };

    node.addEventListener('focusout', onFocusOut);

    return () => node.removeEventListener('focusout', onFocusOut);
  }, [ ref, handler ]);
}

function clamp(index, count) {
  return Math.max(0, Math.min(index, count - 1));
}

function step(index, delta, count, wrap) {
  const next = index + delta;

  if (wrap) {
    return (next + count) % count;
  }

  return clamp(next, count);
}
