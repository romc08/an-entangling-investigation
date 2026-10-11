// A desk tool, not an evidence move: return home after every drop/cancellation.
export function mountMagnifier(root, { inspect, announce }) {
  const tool = root.querySelector('#magnifier');
  let drag = null;
  let armed = false;
  let suppressClick = false;
  const cards = () => [...root.querySelectorAll('[data-desk-card]')];
  const cardAt = (x, y) => cards().reverse().find(card => {
    const box = card.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
  function select(value) {
    armed = value;
    tool.setAttribute('aria-pressed', String(value));
    root.querySelector('.desk').classList.toggle('magnifier-selected', value);
  }
  function clearDrag() {
    const previous = drag;
    drag = null;
    tool.style.translate = '';
    tool.classList.remove('dragging');
    cards().forEach(card => card.classList.remove('inspect-hover'));
    if (previous && tool.hasPointerCapture(previous.pointer)) tool.releasePointerCapture(previous.pointer);
  }
  function reset() { clearDrag(); select(false); }
  tool.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    suppressClick = false;
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    tool.setPointerCapture(event.pointerId);
  });
  tool.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    select(true);
    tool.classList.add('dragging');
    tool.style.translate = `${dx}px ${dy}px`;
    const target = cardAt(event.clientX, event.clientY);
    cards().forEach(card => card.classList.toggle('inspect-hover', card === target));
  });
  tool.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const moved = drag.moved;
    const card = cardAt(event.clientX, event.clientY);
    clearDrag();
    if (!moved) return;
    suppressClick = true;
    select(false);
    if (card) inspect(card.dataset.deskCard, tool);
    else announce('Magnifying glass returned to the mat.');
  });
  tool.addEventListener('pointercancel', reset);
  tool.addEventListener('lostpointercapture', () => { if (drag) reset(); });
  root.addEventListener('click', event => {
    if (suppressClick && event.target.closest('#magnifier') && event.detail !== 0) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
    suppressClick = false;
  }, true);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (armed || drag)) {
      event.preventDefault(); reset(); tool.focus();
    }
  });
  window.addEventListener('blur', reset);
  window.addEventListener('resize', reset);
  return {
    reset,
    isArmed: () => armed,
    toggle() {
      select(!armed);
      announce(armed ? 'Choose an evidence card to inspect. Escape puts the glass down.' : 'Magnifying glass returned to the mat.');
    },
  };
}
