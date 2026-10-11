// Pointer capture supports mouse, pen and touch without native HTML drag/drop.
// The game owns card locations; this module only previews a drag and reports it.
export function mountCardDragging(root, { move, announce }) {
  let drag = null;
  let suppressClick = null;
  const area = root.querySelector('#evidence-cards');
  const targets = ['notebook', 'report'].map(id => root.querySelector(`#${id}`));
  function targetAt(x, y) {
    return targets.find(target => {
      const box = target.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
  }
  function clear() {
    if (!drag) return;
    drag.button.style.translate = '';
    drag.button.classList.remove('dragging');
    if (drag.button.hasPointerCapture(drag.pointer)) drag.button.releasePointerCapture(drag.pointer);
    targets.forEach(target => target.classList.remove('drop-ready', 'drop-hover'));
    drag = null;
  }
  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-desk-card]');
    if (!button || !event.isPrimary || event.button !== 0 || drag) return;
    suppressClick = null;
    const box = button.getBoundingClientRect();
    drag = { button, pointer: event.pointerId, x: event.clientX, y: event.clientY,
      centerX: box.left + box.width / 2, centerY: box.top + box.height / 2, moved: false };
    button.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    drag.button.classList.add('dragging');
    drag.button.style.translate = `${dx}px ${dy}px`;
    const target = targetAt(event.clientX, event.clientY);
    targets.forEach(item => {
      item.classList.add('drop-ready');
      item.classList.toggle('drop-hover', item === target);
    });
  });
  root.addEventListener('pointerup', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const current = drag;
    const target = targetAt(event.clientX, event.clientY);
    const box = area.getBoundingClientRect();
    clear();
    if (!current.moved) return;
    suppressClick = current.button;
    move(current.button.dataset.deskCard, target?.id || 'desk', target ? undefined : {
      x: (current.centerX + event.clientX - current.x - box.left) / box.width,
      y: (current.centerY + event.clientY - current.y - box.top) / box.height,
    });
    if (target) { target.focus({ preventScroll: true }); announce(`Evidence moved to the ${target.id}.`); }
  });
  root.addEventListener('pointercancel', clear);
  root.addEventListener('lostpointercapture', () => { if (drag) clear(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); clear(); }
  });
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
  root.addEventListener('click', event => {
    if (suppressClick && event.target.closest('[data-desk-card]') === suppressClick && event.detail !== 0) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
    suppressClick = null;
  }, true);
}
