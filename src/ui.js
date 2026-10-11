import { createGame } from './game.js';
import { createWorkbench } from './workbench.js';
import { createTrace } from './assistant.js';
import { mountCardDragging } from './desk-cards.js';
import { mountMagnifier } from './magnifier.js';
import { inspectionPanel } from './inspection.js';
import { createTypewriter } from './typewriter.js';
import { mountOpening } from './opening.js';
import { notebookPage, reportContents, endingContents } from './case-panels.js';
import { ART } from './assets.js';
import { TESTS, PREDICTIONS, OUTCOMES, hasInterpretation } from './evidence.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const percent = value => `${(value * 100).toFixed(1)}%`;
const tokenLabels = { matching: 'Mostly matching', mixed: 'About half matching', unsure: 'Not sure yet' };
const tokenIcons = { matching: '00 · 11', mixed: '00 · 01 · 10 · 11', unsure: '? ?' };
const sprite = (name, className = '') => `<img class="sprite ${className}" src="${ART[name]}" alt="" draggable="false">`;

export function mountGame(root, adapter) {
  const game = createGame(adapter);
  const bench = createWorkbench(game);
  const trace = createTrace();
  let overlay = null;
  let endingDestination = null;
  let opener = null;
  let selectedRecords = [];
  let selectedCard = null;
  let magnifier;
  let inspectionView = 'together';
  let inspectionReturn = 'card';
  let notice = '';
  let readoutTimer;
  let hint = { stage: 'Welcome', text: 'The labels are missing, detective. Change the view. Follow the evidence. I’m on the line.' };
  const drafts = {};
  const reportDraft = { conclusion: '', citations: [], reasoningId: '', reasoning: '' };

  root.innerHTML = `
    <div class="game-shell" data-scene="opening">
      ${sprite('workbench', 'scene-background')}
      ${adapter.isDevelopment ? `<div class="provenance">${escape(adapter.label)}</div>` : ''}
      <main id="workspace" hidden>
        <section class="desk" aria-label="Investigation workbench">
          <div id="devices"></div>
          <div id="desk-objects"></div>
          <div id="evidence-cards" aria-label="Evidence on the desk"></div>
        </section>
        <p id="lab-status" class="lab-alert" role="status" aria-live="polite" hidden></p>
        <p id="desk-announcement" class="sr-only" role="status" aria-live="polite"></p>
        <div class="scene-hud"><button id="help" class="quiet" aria-haspopup="dialog">Field guide [?]</button></div>
      </main>
      <footer>This effort is supported by Qollab &amp; IonQ</footer>
    </div>
    <section id="opening" aria-label="Opening film"><button id="play" class="play-button">Play</button><video id="intro-film" playsinline preload="metadata" hidden aria-label="Trace introduces the investigation"></video><div id="film-controls" hidden><button id="resume-film" hidden>Resume film</button><button id="pause-film">Pause</button><button id="mute-film" aria-pressed="false">Mute</button><button id="skip-film">Skip intro →</button></div><p id="film-error" role="alert" hidden></p></section>
    <dialog id="ending-dialog" aria-labelledby="ending-title"></dialog>
    <dialog id="desk-dialog" aria-labelledby="dialog-title"><div class="dialog-header"><div><span id="dialog-eyebrow" class="eyebrow"></span><h2 id="dialog-title"></h2></div><button id="close-panel" class="close-panel" aria-label="Close panel">×</button></div><div id="dialog-body"></div><p id="dialog-error" class="error" role="alert" tabindex="-1"></p></dialog>`;
  const find = selector => root.querySelector(selector);
  const dialog = find('#desk-dialog');
  const ending = find('#ending-dialog');
  const state = () => game.snapshot();
  const announce = text => { find('#desk-announcement').textContent = text; };
  const speech = createTypewriter({
    write: text => { if (overlay === 'trace') find('#hint-response').textContent = text; },
  });

  function speak() {
    find('#hint-accessible').textContent = hint.text;
    speech.start(hint.text, matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function instruction(progress, setup) {
    if (notice) return notice;
    if (progress.status === 'failed') return 'The lab could not collect this batch. Read the error above before starting a new run.';
    if (setup.reading) return 'Reading the stored measurement…';
    if (!setup.device) return 'Examine a device to begin.';
    if (setup.result) return `Evidence card ${setup.result.card.number} is in the ${setup.result.card.location}.`;
    if (!setup.prediction) return 'Choose a view. Place your prediction.';
    if (progress.status !== 'ready') return 'Waiting for the lab measurements…';
    return 'Pull the lever to uncover the record.';
  }

  function renderDesk() {
    // An open dialog is outside these fragments, so backend completion cannot
    // erase notebook drafts or interrupt focus inside an overlay.
    const progress = state();
    const setup = bench.snapshot();
    const activeId = root.contains(document.activeElement) ? document.activeElement.id : '';
    find('.game-shell').dataset.scene = progress.phase === 'intro' ? 'opening' : 'workbench';
    find('#workspace').hidden = progress.phase === 'intro';
    find('#lab-status').textContent = progress.status === 'failed' ? progress.error : '';
    find('#lab-status').hidden = progress.status !== 'failed';
    // Keep large embedded images and their hit targets mounted between actions.
    if (!find('#device-A')) {
      find('#devices').innerHTML = ['A', 'B'].map(id => `<button id="device-${id}" class="scene-object device-object device-${id}" data-device="${id}" aria-label="Examine Device ${id}" aria-haspopup="dialog">${sprite(`device${id}`)}<span class="object-label">${sprite(id === 'A' ? 'label1' : 'label2')}</span></button>`).join('');
      find('#desk-objects').innerHTML = `
      <button id="trace" class="scene-object phone-object" aria-label="Call Trace" aria-haspopup="dialog">${sprite('phone')}<span class="object-label">${sprite('label3')}</span></button>
      <button id="notebook" class="scene-object notebook-object" aria-label="Open evidence notebook" aria-haspopup="dialog">${sprite('notebook')}<span class="object-label">${sprite('label4')}</span></button>
      <button id="report" class="scene-object report-object" aria-label="Open final report" aria-haspopup="dialog">${sprite('report')}<span class="object-label">${sprite('label5')}</span></button>
      <button type="button" id="magnifier" class="scene-object magnifier-object" aria-label="Magnifying glass: drag onto a card, or select then choose a card" aria-pressed="false" title="Drag onto a card, or click then choose a card">${sprite('magnifier')}<span class="magnifier-prompt">Choose a card</span></button>`;
    }
    renderCards(progress.evidence);
    if (overlay === 'device') renderInstrument();
    if (activeId) find(`#${activeId}`)?.focus({ preventScroll: true });
  }

  function renderCards(records) {
    const area = find('#evidence-cards');
    area.querySelectorAll('[data-desk-card]').forEach(button => {
      if (!records.some(row => row.id === button.dataset.deskCard && row.card.location === 'desk')) button.remove();
    });
    for (const row of records.filter(item => item.card.location === 'desk')) {
      let button = find(`#card-${row.id}`);
      if (!button) {
        area.insertAdjacentHTML('beforeend', `<button id="card-${row.id}" class="evidence-card" data-desk-card="${row.id}" aria-label="Evidence card ${row.card.number}: Device ${row.device}, ${row.test_id.toUpperCase()}. Open or drag to notebook or final report." aria-haspopup="dialog" title="Open, or drag to notebook / final report">${sprite(`evidence${row.card.number}`)}<span class="card-caption" aria-hidden="true">${row.device} · ${row.test_id.toUpperCase()}</span></button>`);
        button = find(`#card-${row.id}`);
      }
      button.style.left = `${row.card.x * 100}%`;
      button.style.top = `${row.card.y * 100}%`;
      button.style.setProperty('--card-angle', `${[-7, 5, 3, -5][row.card.number - 1]}deg`);
    }
  }

  function moveCard(id, destination, position) {
    game.moveEvidence(id, destination, position);
    reportDraft.citations = reportDraft.citations.filter(citation => state().evidence.some(row => row.id === citation && row.card.location === 'report'));
    selectedRecords = selectedRecords.filter(record => state().evidence.some(row => row.id === record && row.card.location === 'notebook'));
    renderDesk();
  }

  function openCard(id, source) {
    selectedCard = id;
    setPanel('card', source);
  }

  function inspectEvidence(id, source) {
    if (!state().evidence.some(row => row.id === id)) return;
    inspectionReturn = overlay === 'notebook' ? 'notebook' : 'card';
    selectedCard = id;
    inspectionView = 'together';
    setPanel('inspection', source);
  }

  function renderInstrument() {
    const progress = state();
    const setup = bench.snapshot();
    const activeId = document.activeElement?.id;
    const angle = TESTS[setup.testId].left;
    find('#controls').innerHTML = `
      <div class="dials"><div><span>LEFT</span><i aria-hidden="true" class="dial ${angle ? 'rotated' : ''}"></i><b>${angle}°</b></div><span class="dial-link" aria-hidden="true">—</span><div><span>RIGHT</span><i aria-hidden="true" class="dial ${angle ? 'rotated' : ''}"></i><b>${angle}°</b></div></div>
      <div class="setting-switch" role="group" aria-label="Measurement view">${Object.keys(TESTS).map(id => `<button id="setting-${id}" data-test="${id}" aria-pressed="${id === setup.testId}" ${setup.reading ? 'disabled' : ''}><b>${id.toUpperCase().split('').join('/')}</b><span>${id === 'zz' ? 'Original view' : 'Rotated view'}</span></button>`).join('')}</div>

      <h3>Your prediction</h3><div class="prediction-tokens" role="group" aria-label="Prediction tokens">${Object.keys(PREDICTIONS).map(id => `<button id="token-${id}" data-prediction="${id}" aria-pressed="${(setup.result?.prediction || setup.prediction) === id}" ${!setup.device || setup.reading || setup.result ? 'disabled' : ''}><span class="token-symbol" aria-hidden="true">${tokenIcons[id]}</span><span>${tokenLabels[id]}</span></button>`).join('')}</div>
      <button id="lever" class="lever ${setup.reading ? 'pulled' : ''}" ${progress.status !== 'ready' || !setup.device || !setup.prediction || setup.result || setup.reading ? 'disabled' : ''}><span class="lever-slot" aria-hidden="true"><i></i></span><span><b>${setup.reading ? 'Reading…' : setup.result ? 'Opened' : 'Uncover'}</b></span><span aria-hidden="true">↓</span></button>`;
    renderDetector(setup);
    find('#instrument-status').textContent = progress.status === 'failed' ? progress.error : instruction(progress, setup);
    if (activeId) find(`#${activeId}`)?.focus({ preventScroll: true });
  }

  function renderDetector(setup) {
    const row = setup.result;
    if (setup.reading) {
      find('#detector-screen').innerHTML = `<div class="crt-screen opening"><span class="screen-label">READING STORED RECORD</span><div class="scan-area" aria-hidden="true"><div class="scan-beam"></div><span>00 01 10 11</span></div><p>Opening Device ${setup.device} · ${setup.testId.toUpperCase()}</p></div><button id="skip-readout" class="detector-button">Skip readout →</button>`;
      return;
    }
    if (!row) {
      find('#detector-screen').innerHTML = `<div class="crt-screen"><span class="screen-label">${setup.device ? `DEVICE ${setup.device} / ${setup.testId.toUpperCase()}` : 'INSTRUMENT OFFLINE'}</span><div class="sealed-mark" aria-hidden="true">${setup.device ? '[ ? ]' : '— —'}</div><p>${setup.device ? 'Record sealed' : 'Awaiting a device'}</p><small>${setup.device ? 'Place your prediction before opening.' : 'Connect Device A or B on the left.'}</small></div><div class="detector-idle">LEFT digit → RIGHT digit</div>`;
      return;
    }
    find('#detector-screen').innerHTML = `<div class="crt-screen"><span class="screen-label">DEVICE ${row.device} / ${row.test_id.toUpperCase()} / ${row.statistics.shots} SHOTS</span>${bars(row)}<div class="screen-stat"><b>${percent(row.statistics.match_rate)}</b><span>matching outputs</span></div><small>Observed counts · Left then Right</small></div><button id="inspect-result" class="detector-button" aria-haspopup="dialog">Inspect card ${row.card.number} ↗</button>`;
  }

  function bars(row) {
    return `<div class="histogram" role="img" aria-label="Observed counts: ${OUTCOMES.map(key => `${key}: ${row.counts[key]}`).join(', ')}">${OUTCOMES.map(key => `<div><span>${row.counts[key]}</span><div class="bar-track"><i class="${key[0] === key[1] ? 'match-bar' : 'different-bar'}" style="height:${100 * row.counts[key] / row.statistics.shots}%"></i></div><b>${key}</b></div>`).join('')}</div>`;
  }

  function showPanelError(message) {
    find('#dialog-error').textContent = message;
    find('#dialog-error').focus();
  }

  function setPanel(kind, source) {
    magnifier?.reset();
    overlay = kind;
    // A link within a panel must return to the original, persistent desk object.
    if (source && !dialog.contains(source)) opener = source.id;
    find('#dialog-error').textContent = '';
    renderPanel();
    if (!dialog.open) dialog.showModal();
    find('#close-panel').focus();
  }

  function renderPanel() {
    speech.stop();
    const setup = bench.snapshot();
    const card = state().evidence.find(row => row.id === selectedCard);
    const panels = { inspection: ['', `Card ${card?.card.number} · ${card?.device} / ${card?.test_id.toUpperCase().split('').join('/')}`], card: ['', `Evidence card ${card?.card.number}`], device: ['', `Device ${setup.device}`], notebook: ['PRIVATE & CONFIDENTIAL', 'Field notes'], trace: ['', 'Trace'], report: ['ARCHIVE COPY', 'Final finding'], help: ['THE INVESTIGATION', 'Your field guide'] };
    const [eyebrow, title] = panels[overlay];
    find('#dialog-eyebrow').textContent = eyebrow;
    find('#dialog-eyebrow').hidden = !eyebrow;
    find('#dialog-title').textContent = title;
    dialog.dataset.panel = overlay;
    dialog.dataset.device = setup.device || 'A';
    find('#dialog-body').innerHTML = overlay === 'device' ? `<div class="instrument-layout"><section class="console" aria-label="Measurement controls"><div id="controls"></div></section><section class="detector" aria-label="Measurement readout"><div id="detector-screen"></div></section></div><p id="instrument-status" class="instrument-status" role="status"></p><details class="batch-note"><summary>Lab notes</summary><p>The lab collects all measurements together. You choose the order to uncover them. This lever opens a stored record; it never sends another job.</p></details>` : overlay === 'notebook' ? notebookPanel() : overlay === 'trace' ? tracePanel() : overlay === 'report' ? reportPanel() : helpPanel();
    if (overlay === 'card') find('#dialog-body').innerHTML = ticket(card);
    if (overlay === 'inspection') find('#dialog-body').innerHTML = inspectionPanel(card, inspectionView);
    if (overlay === 'trace') speak();
    if (overlay === 'device') renderInstrument();
    if (overlay === 'notebook' && setup.device) find('#dialog-body').insertAdjacentHTML('beforeend', `<button id="back-device" class="secondary">← Return to Device ${setup.device}</button>`);
  }

  function notebookPanel() {
    const records = state().evidence.filter(row => row.card.location === 'notebook');
    if (!records.length) return `<div class="empty-panel"><span aria-hidden="true">▤</span><h3>A fresh page.</h3><p>Drag a desk card into the notebook to file it here.</p></div>`;
    if (!selectedRecords.length) selectedRecords = [records.at(-1).id];
    return `<p class="panel-intro">Compare two records. Mark what you observe.</p><div class="record-tabs" role="group" aria-label="Records to inspect">${records.map(row => `<button data-record="${row.id}" aria-pressed="${selectedRecords.includes(row.id)}">${row.device} · ${row.test_id.toUpperCase()}<span>${hasInterpretation(row) ? '✓' : '○'}</span></button>`).join('')}</div><div class="tickets ${selectedRecords.length === 2 ? 'comparison' : ''}">${selectedRecords.map(id => records.find(row => row.id === id)).filter(Boolean).map(ticket).join('')}</div>`;
  }

  function ticket(row) {
    return `<div class="evidence-page">${notebookPage(row, drafts[row.id], bars)}<div class="card-actions" aria-label="Evidence card ${row.card.number} actions"><button type="button" class="secondary" data-magnify="${row.id}">Inspect closely</button>${[['desk', 'Return to desk'], ['notebook', 'File in notebook'], ['report', 'Attach to report']].filter(([place]) => place !== row.card.location).map(([place, label]) => `<button type="button" class="secondary" data-move-card="${row.id}" data-destination="${place}">${label}</button>`).join('')}</div></div>`;
  }

  function tracePanel() {
    return `<div class="trace-dialogue">${sprite('phone', 'trace-portrait')}<div><span class="eyebrow">${escape(hint.stage.toUpperCase())}</span><p id="hint-response" aria-hidden="true"></p><p id="hint-accessible" class="sr-only" role="status" aria-live="polite"></p></div></div><div class="hint-choices"><button data-hint="challenge">Challenge my theory</button><button data-hint="explain">Explain this result</button><button data-hint="next">Suggest a next step</button></div><p class="exchange-status">● Line connected</p>`;
  }

  function reportPanel() { return reportContents(state(), reportDraft, sprite); }

  function sealReport() {
    // Read the current controls as well as retaining drafts between panels.
    // Do not rely on a native form submission: embedded hosts may block it
    // before our submit handler ever runs, even with preventDefault().
    const form = find('#report-form');
    Object.assign(reportDraft, {
      conclusion: form.querySelector('[name="conclusion"]:checked')?.value || '',
      citations: [...form.querySelectorAll('[name="citation"]:checked:not(:disabled)')].map(input => input.value),
      reasoningId: form.querySelector('[name="reason"]:checked')?.value || '',
      reasoning: find('#report-reasoning').value,
    });
    game.submitReport(reportDraft);
    showEnding();
    renderDesk();
  }

  function saveNote(id) {
    game.interpret(id, find(`#note-${id}`).value);
    renderPanel();
    find(`#note-${id}`).closest('details').open = true;
    find(`#note-${id}`).focus();
    renderDesk();
  }

  function showEnding() {
    dialog.close();
    ending.dataset.outcome = state().report.feedback.outcome;
    ending.innerHTML = endingContents(state().report, sprite);
    ending.showModal();
    find('#ending-return').focus();
  }
  ending.addEventListener('close', () => {
    const destination = endingDestination;
    endingDestination = null;
    if (destination) setPanel(destination, find(`#${destination}`));
    else find('#report').focus({ preventScroll: true });
  });

  function helpPanel() {
    return `<ol class="help-steps"><li><b>Connect a device.</b> Click Device A or B. Their labels stay fixed for this run.</li><li><b>Choose a view.</b> The linked dials turn both measurements together: original (Z/Z, 0°) or rotated (X/X, 90°).</li><li><b>Make a prediction.</b> Place one of the three tokens. Being unsure is welcome.</li><li><b>Pull the lever.</b> A numbered evidence card arrives on the desk.</li><li><b>Collect your evidence.</b> Drag cards into the notebook to compare and mark observations. Use Return to desk to take one back out.</li><li><b>Look closer.</b> Drag the magnifying glass onto a card, or click the glass then a card. Compare Left, Right and Together. Filed cards have an Inspect closely button.</li><li><b>Restore the labels.</b> Drag cards onto the final report, then select which to cite. You may also report insufficient evidence.</li></ol><p>The lab submits one batch for the entire case. Opening records never sends another quantum job. Closing panels does not lose your work; reloading the page does. Trace uses scripted hints based on your discovered records.</p><p><b>Keyboard:</b> Tab between objects, Enter or Space to open. Every card has filing buttons as an alternative to dragging. Escape closes a panel or cancels a drag. The readout animation has a Skip button and respects reduced motion.</p><details class="circuit-notes"><summary>Optional circuit notes & limits</summary><p>Left is qubit 0; Right is qubit 1. Every shot prepares a fresh state. The Bell preparation uses H followed by CNOT to prepare |Φ+⟩ = (|00⟩ + |11⟩)/√2. The ordinary mixture combines equal shots of separate |00⟩ and |11⟩ product-state preparations, without an ancilla.</p><p>Ry(−angle) precedes measurement. Qiskit bitstrings are reversed once in Python so displayed digits always mean Left then Right. Both sources use two circuits per setting and report their actual combined counts.</p><p>Ideally, Z/Z produces half 00 and half 11 for both sources. In X/X, the Bell source retains this pattern while the mixture produces all four outcomes equally. These settings distinguish these specified candidates, not arbitrary states.</p><p>The batch also includes CHSH: Left 0°/90°, Right 45°/−45°. E = (matching − differing)/shots and S = E00 + E01 + E10 − E11, ideally 2√2 for the Bell source. The classical expectation bound |S| ≤ 2 requires CHSH assumptions including locality, independent setting choices and fair sampling. Finite samples require uncertainty analysis. Low S does not prove separability. Simulator results do not demonstrate computational advantage. The CHSH interface is deferred.</p></details>`;
  }

  dialog.addEventListener('close', () => {
    speech.stop();
    overlay = null;
    find('#dialog-error').textContent = '';
    if (!ending.open) (find(`#${opener || 'notebook'}`) || find('#notebook')).focus({ preventScroll: true });
  });
  // Native dialog provides focus containment and Escape handling.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });

  function finishReadout() {
    if (!bench.snapshot().reading) return;
    clearTimeout(readoutTimer);
    const row = bench.finishReadout();
    notice = `Evidence card ${row.card.number} is on the desk.`;
    renderDesk();
    announce(`${notice} Drag it to the notebook or final report, or open it for filing buttons.`);
    // Keep the device readout open for inspection; only the player closes it.
    // Other open panels keep their drafts and focus as the desk card arrives.
    if (dialog.open && overlay === 'device') find('#inspect-result').focus({ preventScroll: true });
    if (!dialog.open && !ending.open) find(`#card-${row.id}`).focus({ preventScroll: true });
  }
  root.addEventListener('animationend', event => {
    if (event.animationName === 'readout-scan' && event.target.classList.contains('scan-beam')) finishReadout();
  });

  root.addEventListener('input', event => {
    const input = event.target;
    if (input.dataset.draft) drafts[input.dataset.draft] = input.value;
    if (input.name === 'conclusion') reportDraft.conclusion = input.value;
    if (input.name === 'reason') reportDraft.reasoningId = input.value;
    if (input.name === 'citation') reportDraft.citations = [...dialog.querySelectorAll('[name="citation"]:checked')].map(el => el.value);
    if (input.id === 'report-reasoning') {
      reportDraft.reasoning = input.value;
      // Typing is an explicit switch to the player's own explanation.
      reportDraft.reasoningId = '';
      dialog.querySelectorAll('[name="reason"]').forEach(radio => { radio.checked = false; });
    }
  });

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      find('#dialog-error').textContent = '';
      if (button.id === 'magnifier') { magnifier.toggle(); return; }
      if (button.dataset.magnify || (button.dataset.deskCard && magnifier.isArmed())) {
        inspectEvidence(button.dataset.magnify || button.dataset.deskCard, button); return;
      }
      if (button.dataset.inspectionView) {
        inspectionView = button.dataset.inspectionView;
        const expanded = find('.inspection-slip').open;
        renderPanel();
        find('.inspection-slip').open = expanded;
        find(`[data-inspection-view="${inspectionView}"]`).focus();
        return;
      }
      if (button.id === 'inspection-back') { setPanel(inspectionReturn); return; }
      if (button.dataset.deskCard || button.dataset.inspectCard) { openCard(button.dataset.deskCard || button.dataset.inspectCard, button); return; }
      if (button.dataset.moveCard) {
        const destination = button.dataset.destination;
        moveCard(button.dataset.moveCard, destination);
        opener = destination === 'desk' ? `card-${button.dataset.moveCard}` : destination;
        dialog.close();
        announce(`Evidence moved to the ${destination}.`);
        return;
      }
      if (button.id === 'seal-report') { event.preventDefault(); sealReport(); return; }
      if (button.dataset.saveNote) { event.preventDefault(); saveNote(button.dataset.saveNote); return; }
      if (button.id === 'view-verdict') { showEnding(); return; }
      if (button.id === 'ending-return' || button.id === 'ending-evidence') {
        endingDestination = button.id === 'ending-evidence' ? 'notebook' : state().report.feedback.outcome === 'revise' ? 'report' : null;
        ending.close(); return;
      }
      if (button.id === 'close-panel') { dialog.close(); return; }
      if (button.dataset.device) {
        if (bench.snapshot().reading && bench.snapshot().device !== button.dataset.device) finishReadout();
        if (!bench.snapshot().reading) bench.selectDevice(button.dataset.device);
        notice = '';
        setPanel('device', button);
        renderDesk();
        return;
      }
      if (button.id === 'back-device') { setPanel('device'); return; }
      if (['notebook', 'trace', 'report', 'help'].includes(button.id)) { setPanel(button.id, button); return; }
      if (button.id === 'inspect-result') { openCard(bench.snapshot().result.id, button); return; }
      if (button.dataset.record) {
        const id = button.dataset.record;
        if (selectedRecords.includes(id)) selectedRecords = selectedRecords.filter(value => value !== id);
        else selectedRecords = [...selectedRecords.slice(-1), id];
        renderPanel();
        dialog.querySelector(`[data-record="${id}"]`).focus();
        return;
      }
      if (button.dataset.claim) {
        game.recordClaim(button.dataset.evidence, button.dataset.claim);
        renderPanel();
        dialog.querySelector(`[data-evidence="${button.dataset.evidence}"][data-claim="${button.dataset.claim}"]`).focus();
        renderDesk();
        return;
      }
      if (button.dataset.hint) {
        const progress = state(); const setup = bench.snapshot();
        hint = trace(button.dataset.hint, { evidence: progress.evidence, status: progress.status, selectedDevice: setup.device || 'A', selectedTest: setup.testId });
        speak();
        dialog.querySelector('.trace-dialogue .eyebrow').textContent = hint.stage.toUpperCase();
        return;
      }
      notice = '';
      if (button.dataset.test) bench.selectTest(button.dataset.test);
      else if (button.dataset.prediction) bench.predict(button.dataset.prediction);
      else if (button.id === 'lever') {
        bench.beginReadout();
        // Closing a device removes its animation. The readout must still finish.
        readoutTimer = setTimeout(finishReadout, 1250);
      }
      else if (button.id === 'skip-readout') { finishReadout(); return; }
      else return;
      renderDesk();
      if (bench.snapshot().reading) find('#skip-readout').focus({ preventScroll: true });
    } catch (error) {
      if (dialog.open) showPanelError(error.message);
      else { notice = error.message; announce(notice); }
    }
  });
  root.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (event.target.dataset.note) {
        saveNote(event.target.dataset.note);
      } else if (event.target.id === 'report-form') {
        sealReport();
      }
      find('#dialog-error').textContent = '';
    } catch (error) { showPanelError(error.message); }
  });
  renderDesk();
  mountCardDragging(root, { move: moveCard, announce });
  magnifier = mountMagnifier(root, { inspect: inspectEvidence, announce });
  mountOpening(root, {
    onStart: () => { game.load().then(renderDesk); },
    onEnter: () => { game.start(); renderDesk(); },
    onReady: () => find('#device-A').focus({ preventScroll: true }),
  });
}
