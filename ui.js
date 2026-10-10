import { createGame } from './game.js';
import { createWorkbench } from './workbench.js';
import { createTrace } from './assistant.js';
import { TESTS, PREDICTIONS, OUTCOMES, CLAIMS, REPORT_REASONS, hasInterpretation } from './evidence.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const percent = value => `${(value * 100).toFixed(1)}%`;
const tokenLabels = { matching: 'Mostly matching', mixed: 'About half matching', unsure: 'Not sure yet' };
const tokenIcons = { matching: '00 · 11', mixed: '00 · 01 · 10 · 11', unsure: '? ?' };
const deviceSprite = `<span class="device-sprite" aria-hidden="true"><i class="screw s1"></i><i class="screw s2"></i><span class="device-window"><i></i><span>↔</span><i></i></span><span class="device-vents">▥ ▥ ▥</span></span>`;

export function mountGame(root, adapter) {
  const game = createGame(adapter);
  const bench = createWorkbench(game);
  const trace = createTrace();
  let overlay = null;
  let opener = null;
  let selectedRecords = [];
  let notice = '';
  let hint = { stage: 'Welcome', text: 'The labels are missing, detective. Select a device, change the view, and follow the evidence. I’m here if you need another perspective.' };
  const drafts = {};
  const reportDraft = { conclusion: '', citations: [], reasoningId: '', reasoning: '' };

  root.innerHTML = `
    <div class="game-shell">
      <div class="provenance">${escape(adapter.label)}</div>
      <header class="game-header"><div class="game-brand"><span aria-hidden="true">◈</span><div>AN ENTANGLING INVESTIGATION<small>THE MUSEUM OF UNFINISHED QUESTIONS</small></div></div><span class="case-number">CASE 001</span></header>
      <section id="title-screen" class="title-screen" aria-labelledby="game-title">
        <div class="title-emblem" aria-hidden="true">${deviceSprite}<span>?</span>${deviceSprite}</div>
        <p class="eyebrow">CONSERVATION LAB · AFTER HOURS</p><h1 id="game-title">Two devices.<br>One missing connection.</h1>
        <p>One exhibit creates an entangled pair. The other creates an ordinary correlated mixture. Restore their labels using the evidence.</p>
        <button id="play" class="primary">Play investigation <span aria-hidden="true">▶</span></button>
        <p class="title-foot">Click the objects on your desk. Predict, uncover, compare.<br>Keyboard: Tab to move · Enter to interact · Esc to close a panel.</p>
        <span class="prototype-label">WORKBENCH PROTOTYPE / PLACEHOLDER ART</span>
      </section>
      <main id="workspace" hidden>
        <div class="mission-bar"><div><span class="eyebrow">YOUR OBJECTIVE</span><p id="objective"></p></div><span id="progress-count" class="progress-count"></span></div>
        <div class="lab-line"><span id="lab-status" role="status" aria-live="polite"></span><button id="help" class="quiet" aria-haspopup="dialog">How to play [?]</button></div>
        <section class="desk" aria-label="Investigation workbench">
          <span class="desk-bolt bolt-tl" aria-hidden="true"></span><span class="desk-bolt bolt-tr" aria-hidden="true"></span>
          <div class="desk-plaque"><span>EXHIBIT RESTORATION / BENCH 07</span><span>PROPERTY OF THE MUSEUM</span></div>
          <div class="apparatus">
            <section class="device-rack" aria-labelledby="devices-label"><h2 id="devices-label">01 / Select a device</h2><div id="devices"></div><p class="rack-note">Identification records missing.<br>Appearance tells you nothing.</p></section>
            <section class="console" aria-labelledby="console-label"><h2 id="console-label">02 / Set the instrument</h2><div id="controls"></div></section>
            <section class="detector" aria-labelledby="detector-label"><div class="detector-heading"><h2 id="detector-label">04 / Detector</h2><span class="power-led" aria-hidden="true"></span></div><div id="detector-screen"></div></section>
          </div>
          <nav id="desk-objects" class="desk-objects" aria-label="Workbench objects"></nav>
          <span class="desk-bolt bolt-bl" aria-hidden="true"></span><span class="desk-bolt bolt-br" aria-hidden="true"></span>
        </section>
        <div id="interaction-line" class="interaction-line" role="status" aria-live="polite"></div>
        <p class="batch-note">The lab collects all preset measurements together in one job. You choose which records to uncover. The lever opens a stored result.</p>
      </main>
      <footer><span>POINT-AND-CLICK PROTOTYPE <span aria-hidden="true">/</span> PROGRESS LASTS FOR THIS RUN</span><span>This effort is supported by Qollab &amp; IonQ</span></footer>
    </div>
    <dialog id="desk-dialog" aria-labelledby="dialog-title"><div class="dialog-header"><div><span id="dialog-eyebrow" class="eyebrow"></span><h2 id="dialog-title"></h2></div><button id="close-panel" class="close-panel" aria-label="Close panel">×</button></div><div id="dialog-body"></div><p id="dialog-error" class="error" role="alert"></p></dialog>`;
  const find = selector => root.querySelector(selector);
  const dialog = find('#desk-dialog');
  const state = () => game.snapshot();

  function goal(progress) {
    if (progress.report) return 'Report filed. You can revisit the evidence and revise your conclusion.';
    if (!progress.evidence.length) return 'Start with a prediction. Matching in one view may not tell the whole story.';
    if (!['A', 'B'].every(id => progress.evidence.some(row => row.device === id && row.test_id === 'xx'))) return 'Investigate both devices. What changes when you rotate the measurement view?';
    if (progress.evidence.some(row => !hasInterpretation(row))) return 'Open your notebook and pin observations to the uncovered records.';
    return 'Compare the records. Open the report folder when you can support a conclusion.';
  }

  function instruction(progress, setup) {
    if (notice) return notice;
    if (progress.status === 'failed') return 'The lab could not collect this batch. Read the error above before starting a new run.';
    if (setup.reading) return 'Opening the stored measurement… You can skip the readout animation.';
    if (!setup.device) return 'Click one of the two devices to connect it to the instrument.';
    if (setup.result) return 'This record is already open. Inspect its ticket, or choose another device or view.';
    if (!setup.prediction) return 'Choose a view, then click a prediction token to place it in the instrument.';
    if (progress.status !== 'ready') return 'Prediction placed. Wait for the lab batch to be ready.';
    return 'Prediction placed. Pull the lever to uncover this record.';
  }

  function renderDesk() {
    // An open dialog is outside these fragments, so backend completion cannot
    // erase notebook drafts or interrupt focus inside an overlay.
    const progress = state();
    const setup = bench.snapshot();
    const activeId = root.contains(document.activeElement) ? document.activeElement.id : '';
    find('#title-screen').hidden = progress.phase !== 'intro';
    find('#workspace').hidden = progress.phase === 'intro';
    find('#objective').textContent = goal(progress);
    find('#progress-count').textContent = `${progress.evidence.length}/4 RECORDS`;
    find('#lab-status').textContent = progress.status === 'loading' ? '● Collecting one complete batch… Remote jobs may queue.' : progress.status === 'failed' ? progress.error : progress.status === 'ready' ? '● Batch ready · all measurements collected' : '● Lab standing by';
    find('#lab-status').classList.toggle('error', progress.status === 'failed');
    find('#devices').innerHTML = ['A', 'B'].map(id => `<button id="device-${id}" class="device-object ${setup.device === id ? 'selected' : ''}" data-device="${id}" aria-pressed="${setup.device === id}" ${setup.reading ? 'disabled' : ''}><span class="object-top"><span>EXHIBIT ${id}</span><span class="selection-light" aria-hidden="true"></span></span>${deviceSprite}<span class="device-name">Device ${id}</span><span class="device-state">${setup.device === id ? 'CONNECTED' : 'CLICK TO CONNECT'} · ${progress.evidence.filter(row => row.device === id).length}/2</span></button>`).join('');
    const angle = TESTS[setup.testId].left;
    find('#controls').innerHTML = `
      <div class="connection-label">${setup.device ? `DEVICE ${setup.device} CONNECTED` : 'NO DEVICE CONNECTED'}</div>
      <div class="dials"><div><span>LEFT</span><i aria-hidden="true" class="dial ${angle ? 'rotated' : ''}"></i><b>${angle}°</b></div><span class="dial-link" aria-hidden="true">—</span><div><span>RIGHT</span><i aria-hidden="true" class="dial ${angle ? 'rotated' : ''}"></i><b>${angle}°</b></div></div>
      <div class="setting-switch" role="group" aria-label="Measurement view">${Object.keys(TESTS).map(id => `<button id="setting-${id}" data-test="${id}" aria-pressed="${id === setup.testId}" ${setup.reading ? 'disabled' : ''}><b>${id.toUpperCase().split('').join('/')}</b><span>${id === 'zz' ? 'Original view' : 'Rotated view'}</span></button>`).join('')}</div>
      <p class="setting-description">${TESTS[setup.testId].purpose}</p>
      <h3>03 / Place a prediction</h3><div class="prediction-tokens" role="group" aria-label="Prediction tokens">${Object.keys(PREDICTIONS).map(id => `<button id="token-${id}" data-prediction="${id}" aria-pressed="${(setup.result?.prediction || setup.prediction) === id}" ${!setup.device || setup.reading || setup.result ? 'disabled' : ''}><span class="token-symbol" aria-hidden="true">${tokenIcons[id]}</span><span>${tokenLabels[id]}</span></button>`).join('')}</div>
      <button id="lever" class="lever ${setup.reading ? 'pulled' : ''}" ${progress.status !== 'ready' || !setup.device || !setup.prediction || setup.result || setup.reading ? 'disabled' : ''}><span class="lever-slot" aria-hidden="true"><i></i></span><span><b>${setup.reading ? 'Reading…' : setup.result ? 'Record uncovered' : 'Pull to uncover'}</b><small>${setup.device ? `Device ${setup.device} · ${setup.testId.toUpperCase()}` : 'Select a device first'}</small></span><span aria-hidden="true">↓</span></button>`;
    renderDetector(setup);
    find('#desk-objects').innerHTML = `
      <button id="notebook" class="desk-object notebook-object" aria-haspopup="dialog" ${setup.reading ? 'disabled' : ''}><span class="notebook-prop" aria-hidden="true"><i></i><b>FIELD<br>NOTES</b></span><span><strong>Evidence notebook</strong><small>${progress.evidence.length ? `${progress.evidence.length} records · ${progress.evidence.filter(hasInterpretation).length} interpreted` : 'Your discoveries go here'}</small></span><span class="object-action">OPEN ↗</span></button>
      <button id="trace" class="desk-object trace-object" aria-haspopup="dialog" ${setup.reading ? 'disabled' : ''}><span class="trace-prop" aria-hidden="true"><b>•_•</b><i>TRACE</i></span><span><strong>Trace terminal</strong><small>A second perspective</small></span><span class="object-action">TALK ↗</span></button>
      <button id="report" class="desk-object report-object" aria-haspopup="dialog" ${setup.reading ? 'disabled' : ''}><span class="folder-prop" aria-hidden="true"><i>CASE<br>001</i></span><span><strong>Final report</strong><small>${progress.report ? 'Filed · open to revise' : 'Restore the missing labels'}</small></span><span class="object-action">OPEN ↗</span></button>`;
    find('#interaction-line').textContent = instruction(progress, setup);
    if (activeId && !dialog.open) find(`#${activeId}`)?.focus({ preventScroll: true });
  }

  function renderDetector(setup) {
    const row = setup.result;
    if (setup.reading) {
      find('#detector-screen').innerHTML = `<div class="crt-screen opening"><span class="screen-label">READING STORED RECORD</span><div class="scan-area" aria-hidden="true"><div class="scan-beam"></div><span>00 01 10 11</span></div><p>Opening Device ${setup.device} · ${setup.testId.toUpperCase()}</p><small>No new quantum job is being sent.</small></div><button id="skip-readout" class="detector-button">Skip readout animation →</button>`;
      return;
    }
    if (!row) {
      find('#detector-screen').innerHTML = `<div class="crt-screen"><span class="screen-label">${setup.device ? `DEVICE ${setup.device} / ${setup.testId.toUpperCase()}` : 'INSTRUMENT OFFLINE'}</span><div class="sealed-mark" aria-hidden="true">${setup.device ? '[ ? ]' : '— —'}</div><p>${setup.device ? 'Record sealed' : 'Awaiting a device'}</p><small>${setup.device ? 'Place your prediction before opening.' : 'Connect Device A or B on the left.'}</small></div><div class="detector-idle">LEFT digit → RIGHT digit</div>`;
      return;
    }
    find('#detector-screen').innerHTML = `<div class="crt-screen"><span class="screen-label">DEVICE ${row.device} / ${row.test_id.toUpperCase()} / ${row.statistics.shots} SHOTS</span>${bars(row)}<div class="screen-stat"><b>${percent(row.statistics.match_rate)}</b><span>matching outputs</span></div><small>Observed counts · Left then Right</small></div><button id="inspect-result" class="detector-button" aria-haspopup="dialog">Inspect evidence ticket ↗</button>`;
  }

  function bars(row) {
    return `<div class="histogram" role="img" aria-label="Observed counts: ${OUTCOMES.map(key => `${key}: ${row.counts[key]}`).join(', ')}">${OUTCOMES.map(key => `<div><span>${row.counts[key]}</span><div class="bar-track"><i class="${key[0] === key[1] ? 'match-bar' : 'different-bar'}" style="height:${100 * row.counts[key] / row.statistics.shots}%"></i></div><b>${key}</b></div>`).join('')}</div>`;
  }

  function setPanel(kind, source) {
    overlay = kind;
    opener = source?.id || opener;
    find('#dialog-error').textContent = '';
    renderPanel();
    if (!dialog.open) dialog.showModal();
    find('#close-panel').focus();
  }

  function renderPanel() {
    const panels = { notebook: ['EVIDENCE & OBSERVATIONS', 'Field notebook'], trace: ['SCRIPTED FIELD ASSISTANT', 'Trace is listening.'], report: ['CASE 001 / YOUR FINDING', 'Restore the exhibit labels'], help: ['THE INVESTIGATION', 'Your workbench, explained'] };
    const [eyebrow, title] = panels[overlay];
    find('#dialog-eyebrow').textContent = eyebrow;
    find('#dialog-title').textContent = title;
    find('#dialog-body').innerHTML = overlay === 'notebook' ? notebookPanel() : overlay === 'trace' ? tracePanel() : overlay === 'report' ? reportPanel() : helpPanel();
  }

  function notebookPanel() {
    const records = state().evidence;
    if (!records.length) return `<div class="empty-panel"><span aria-hidden="true">▤</span><h3>A fresh page.</h3><p>Select a device, choose a view, place a prediction, and pull the lever. Your first record will appear here.</p></div>`;
    if (!selectedRecords.length) selectedRecords = [records.at(-1).id];
    return `<p class="panel-intro">Select up to two tickets to compare. Pin an observation to make a record available for your report.</p><div class="record-tabs" role="group" aria-label="Records to inspect">${records.map(row => `<button data-record="${row.id}" aria-pressed="${selectedRecords.includes(row.id)}">${row.device} · ${row.test_id.toUpperCase()}<span>${hasInterpretation(row) ? '● interpreted' : '○ needs observation'}</span></button>`).join('')}</div><div class="tickets ${selectedRecords.length === 2 ? 'comparison' : ''}">${selectedRecords.map(id => records.find(row => row.id === id)).filter(Boolean).map(ticket).join('')}</div>${selectedRecords.length === 2 ? '<p class="comparison-note">Compare the view, matching fraction, and sampling intervals. Z/Z can look alike for both preparations; changing the view tests a different prediction.</p>' : ''}`;
  }

  function ticket(row) {
    const s = row.statistics;
    return `<article class="ticket"><div class="ticket-heading"><h3>Device ${row.device} / ${row.test_id.toUpperCase()}</h3><span>${s.shots} SHOTS</span></div><p class="ticket-setting">Left ${row.settings.left}° · Right ${row.settings.right}°</p>${bars(row)}<div class="ticket-stats"><b>${percent(s.match_rate)} matching</b><span>E = ${s.correlation.toFixed(3)}</span></div><p class="small">95% sampling interval: ${percent(s.match_interval[0])}–${percent(s.match_interval[1])}. Conservative Hoeffding bound; independent shots assumed. Does not include device noise.</p><p class="ticket-prediction"><b>You predicted:</b> ${escape(PREDICTIONS[row.prediction])}</p><fieldset class="claim-choices"><legend>Pin an observation</legend>${Object.entries(CLAIMS).map(([id, label]) => `<button data-claim="${id}" data-evidence="${row.id}" aria-pressed="${row.claim === id}">${row.claim === id ? '● ' : '○ '}${escape(label)}</button>`).join('')}</fieldset><details><summary>Add your own note (optional)</summary><form data-note="${row.id}"><label for="note-${row.id}">Your interpretation</label><textarea id="note-${row.id}" data-draft="${row.id}" minlength="10" maxlength="2000" rows="3">${escape(drafts[row.id] ?? row.interpretation)}</textarea><button class="secondary" type="submit">Save note</button></form></details><p class="ticket-source">${escape(row.provenance.label)}</p><p class="saved-observation" role="status">${hasInterpretation(row) ? '✓ Interpretation pinned to this record' : 'Choose an observation to use this record in your report'}</p></article>`;
  }

  function tracePanel() {
    return `<div class="trace-dialogue"><span class="trace-avatar" aria-hidden="true">•_•</span><div><span class="eyebrow">${escape(hint.stage.toUpperCase())}</span><p id="hint-response" role="status" aria-live="polite">${escape(hint.text)}</p></div></div><div class="hint-choices"><button data-hint="challenge">Challenge my theory</button><button data-hint="explain">Explain this result</button><button data-hint="next">Suggest a next step</button></div><p class="small">Ask again for a question, then a more direct suggestion. Trace only knows the records you have uncovered.</p>`;
  }

  function reportPanel() {
    const progress = state();
    return `<p class="panel-intro">Restore the labels using interpreted evidence. Leaving the case open is a valid finding.</p><form id="report-form"><fieldset><legend>Choose your conclusion</legend><div class="conclusion-tiles">${[['A', 'Device A is the Bell candidate'], ['B', 'Device B is the Bell candidate'], ['insufficient', 'Insufficient evidence']].map(([value, label]) => `<label><input type="radio" name="conclusion" value="${value}" ${reportDraft.conclusion === value ? 'checked' : ''} required><span>${label}</span></label>`).join('')}</div></fieldset><fieldset><legend>Attach supporting records</legend><p class="small">Identifying a device needs interpreted X/X records from both devices.</p>${progress.evidence.length ? progress.evidence.map(row => `<label class="citation"><input type="checkbox" name="citation" value="${row.id}" ${reportDraft.citations.includes(row.id) ? 'checked' : ''} ${hasInterpretation(row) ? '' : 'disabled'}><span>Device ${row.device} · ${row.test_id.toUpperCase()} ${hasInterpretation(row) ? '' : '— pin an observation first'}</span></label>`).join('') : '<p>No records yet. Return to the apparatus and uncover a measurement.</p>'}</fieldset><fieldset><legend>Choose your reasoning</legend>${Object.entries(REPORT_REASONS).map(([value, label]) => `<label class="reason-choice"><input type="radio" name="reason" value="${value}" ${reportDraft.reasoningId === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}<details><summary>Or write your reasoning</summary><label for="report-reasoning">Optional written reasoning (20 characters minimum if no tile is selected)</label><textarea id="report-reasoning" rows="3" maxlength="3000">${escape(reportDraft.reasoning)}</textarea></details></fieldset><p class="small">This comparison distinguishes the two specified preparations. It is not a universal test for entanglement.</p><button type="submit" class="primary">File the report →</button></form>${progress.report ? `<section id="report-feedback" class="report-feedback" tabindex="-1" role="status"><h3>${escape(progress.report.feedback.title)}</h3><p>${escape(progress.report.feedback.message)}</p><p class="small">Saved for this run. You can return to the bench and revise it.</p></section>` : ''}`;
  }

  function helpPanel() {
    return `<ol class="help-steps"><li><b>Connect a device.</b> Click Device A or B. Their labels stay fixed for this run.</li><li><b>Choose a view.</b> The linked dials turn both measurements together: original (Z/Z, 0°) or rotated (X/X, 90°).</li><li><b>Make a prediction.</b> Place one of the three tokens. Being unsure is welcome.</li><li><b>Pull the lever.</b> Uncover a stored record, then inspect its ticket.</li><li><b>Collect your evidence.</b> Pin an observation in the notebook. Open two tickets to compare.</li><li><b>Restore the labels.</b> Cite your evidence in the report, or explain why it is insufficient.</li></ol><p>The lab submits one batch for the entire case. Opening records never sends another quantum job. Closing panels does not lose your work; reloading the page does.</p><p><b>Keyboard:</b> Tab between objects, Enter or Space to activate, Escape to close a panel. The readout animation has a Skip button and respects reduced motion.</p><details class="circuit-notes"><summary>Optional circuit notes & limits</summary><p>Left is qubit 0; Right is qubit 1. Every shot prepares a fresh state. The Bell preparation uses H followed by CNOT to prepare |Φ+⟩ = (|00⟩ + |11⟩)/√2. The ordinary mixture combines equal shots of separate |00⟩ and |11⟩ product-state preparations, without an ancilla.</p><p>Ry(−angle) precedes measurement. Qiskit bitstrings are reversed once in Python so displayed digits always mean Left then Right. Both sources use two circuits per setting and report their actual combined counts.</p><p>Ideally, Z/Z produces half 00 and half 11 for both sources. In X/X, the Bell source retains this pattern while the mixture produces all four outcomes equally. These settings distinguish these specified candidates, not arbitrary states.</p><p>The batch also includes CHSH: Left 0°/90°, Right 45°/−45°. E = (matching − differing)/shots and S = E00 + E01 + E10 − E11, ideally 2√2 for the Bell source. The classical expectation bound |S| ≤ 2 requires CHSH assumptions including locality, independent setting choices and fair sampling. Finite samples require uncertainty analysis. Low S does not prove separability. Simulator results do not demonstrate computational advantage. The CHSH interface is deferred.</p></details>`;
  }

  dialog.addEventListener('close', () => {
    overlay = null;
    find('#dialog-error').textContent = '';
    find(`#${opener || 'notebook'}`)?.focus({ preventScroll: true });
  });
  // Native dialog provides focus containment and Escape handling.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });

  function finishReadout() {
    if (!bench.snapshot().reading) return;
    const row = bench.finishReadout();
    notice = `Device ${row.device} · ${row.test_id.toUpperCase()} uncovered. Inspect the ticket to pin an observation.`;
    renderDesk();
    // Opening help while the scan runs must not steal focus out of its dialog.
    if (!dialog.open) find('#inspect-result').focus({ preventScroll: true });
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
    if (overlay === 'report') find('#report-feedback')?.remove();
  });

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      find('#dialog-error').textContent = '';
      if (button.id === 'play') {
        game.start();
        const loaded = game.load();
        renderDesk();
        find('#device-A').focus({ preventScroll: true });
        await loaded;
        renderDesk();
        return;
      }
      if (button.id === 'close-panel') { dialog.close(); return; }
      if (['notebook', 'trace', 'report', 'help'].includes(button.id)) { setPanel(button.id, button); return; }
      if (button.id === 'inspect-result') { selectedRecords = [bench.snapshot().result.id]; setPanel('notebook', button); return; }
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
        find('#hint-response').textContent = hint.text;
        dialog.querySelector('.trace-dialogue .eyebrow').textContent = hint.stage.toUpperCase();
        return;
      }
      notice = '';
      if (button.dataset.device) bench.selectDevice(button.dataset.device);
      else if (button.dataset.test) bench.selectTest(button.dataset.test);
      else if (button.dataset.prediction) bench.predict(button.dataset.prediction);
      else if (button.id === 'lever') bench.beginReadout();
      else if (button.id === 'skip-readout') { finishReadout(); return; }
      else return;
      renderDesk();
      if (bench.snapshot().reading) find('#skip-readout').focus({ preventScroll: true });
    } catch (error) {
      if (dialog.open) find('#dialog-error').textContent = error.message;
      else { notice = error.message; find('#interaction-line').textContent = notice; }
    }
  });
  root.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (event.target.dataset.note) {
        const id = event.target.dataset.note;
        game.interpret(id, find(`#note-${id}`).value);
        renderPanel();
        // Reopen the details element before focusing the optional text field.
        find(`#note-${id}`).closest('details').open = true;
        find(`#note-${id}`).focus();
      } else if (event.target.id === 'report-form') {
        game.submitReport(reportDraft);
        renderPanel();
        find('#report-feedback').focus();
      }
      find('#dialog-error').textContent = '';
      renderDesk();
    } catch (error) { find('#dialog-error').textContent = error.message; }
  });
  renderDesk();
}
