import { CLAIMS, PREDICTIONS, hasInterpretation } from './evidence.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pct = n => `${(n * 100).toFixed(1)}%`;

export function notebookPage(row, draft, bars) {
  const s = row.statistics;
  const names = { matching: 'Matching dominates', half: 'About half match', unresolved: 'Still inconclusive' };
  return `<article class="ticket">
    <div class="ticket-heading"><h3>Device ${row.device}</h3><span>${row.test_id.toUpperCase().split('').join(' / ')}</span></div>
    <p class="ticket-setting">L ${row.settings.left}° · R ${row.settings.right}° · ${s.shots} shots</p>
    ${bars(row)}<div class="ticket-stats"><b>${pct(s.match_rate)} matching</b><span>E ${s.correlation.toFixed(3)}</span></div>
    <details class="measurement-details"><summary>Measurement notes</summary>
      <p class="small">95% sampling interval: ${pct(s.match_interval[0])}–${pct(s.match_interval[1])}. Conservative Hoeffding bound; independent shots assumed. Sampling uncertainty only.</p>
      <p class="small">Prediction: ${esc(PREDICTIONS[row.prediction])}</p>
      <p class="ticket-source">${esc(row.provenance.label)}</p>
    </details>
    <fieldset class="claim-choices"><legend>My observation</legend>${Object.entries(CLAIMS).map(([id, label]) => `<button data-claim="${id}" data-evidence="${row.id}" aria-label="${esc(label)}" aria-pressed="${row.claim === id}"><span aria-hidden="true">${row.claim === id ? '✓' : '○'}</span> ${names[id]}</button>`).join('')}</fieldset>
    <details><summary>Personal note</summary><form data-note="${row.id}"><label class="sr-only" for="note-${row.id}">Your interpretation</label><textarea id="note-${row.id}" data-draft="${row.id}" minlength="10" maxlength="2000" rows="3">${esc(draft ?? row.interpretation)}</textarea><button class="secondary" type="submit">Save note</button></form></details>
    <p class="saved-observation" role="status">${hasInterpretation(row) ? '✓ Entered in the record' : ''}</p>
  </article>`;
}

export function reportContents(progress, draft, sprite) {
  return `<div class="dossier-heading"><span>MUSEUM OF UNFINISHED QUESTIONS</span><b>Identification record</b><i>No. 001</i></div>
    <form id="report-form">
    <fieldset><legend>The Bell preparation belongs to…</legend><div class="conclusion-tiles">${['A', 'B'].map(id => `<label><input type="radio" name="conclusion" value="${id}" ${draft.conclusion === id ? 'checked' : ''} required>${sprite(`device${id}`)}<span>Device ${id}</span></label>`).join('')}<label class="leave-open"><input type="radio" name="conclusion" value="insufficient" ${draft.conclusion === 'insufficient' ? 'checked' : ''} required><span>Insufficient<br>evidence</span></label></div></fieldset>
    <div class="report-columns"><fieldset><legend>Attach evidence</legend>${progress.evidence.length ? progress.evidence.map(row => `<label class="citation"><input type="checkbox" name="citation" value="${row.id}" ${draft.citations.includes(row.id) ? 'checked' : ''} ${hasInterpretation(row) ? '' : 'disabled'}><span>${row.device} / ${row.test_id.toUpperCase()} ${hasInterpretation(row) ? '' : '<small>needs observation</small>'}</span></label>`).join('') : '<p class="small">Your notebook is empty.</p>'}<p class="small citation-help">Naming a device needs both X/X records.</p></fieldset>
    <fieldset><legend>My reasoning</legend>${[['compare', 'X/X separates the candidates.'], ['limited', 'The evidence is inconclusive.']].map(([value, label]) => `<label class="reason-choice"><input type="radio" name="reason" value="${value}" ${draft.reasoningId === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}<details><summary>Write my own</summary><label class="sr-only" for="report-reasoning">Your reasoning (at least 20 characters)</label><textarea id="report-reasoning" rows="3" maxlength="3000">${esc(draft.reasoning)}</textarea></details></fieldset></div>
    <div class="signing-line"><span>Submitted by<br><i>The investigating detective</i></span><button type="submit" class="seal-button">Seal<br>report</button></div></form>
    ${progress.report ? '<button id="view-verdict" class="secondary">Read filed verdict</button>' : ''}`;
}

export function endingContents(report, sprite) {
  const outcome = report.feedback.outcome;
  const solved = outcome === 'solved';
  const open = outcome === 'inconclusive';
  return `<div class="ending-folio"><p class="ending-kicker">THE MUSEUM OF UNFINISHED QUESTIONS</p>
    <div class="verdict-stamp" aria-hidden="true">${solved ? 'CASE CLOSED' : open ? 'ON FILE' : 'RETURNED'}</div>
    <h1 id="ending-title">${solved ? 'The labels are restored.' : open ? 'Some questions remain.' : 'Not yet, detective.'}</h1>
    ${solved ? `<div class="restored-devices">${['A', 'B'].map(id => `<div>${sprite(`device${id}`)}<span>Device ${id}</span><b>${id === report.conclusion ? 'Bell preparation' : 'Correlated mixture'}</b></div>`).join('')}</div><p>Your comparison solved the missing-label case.</p>` : `<div class="verdict-emblem" aria-hidden="true">${open ? '?' : '×'}</div><p>${open ? 'An honest limit is a finding, too. The case stays open.' : 'This verdict cannot close the case. Revisit the X/X evidence.'}</p>`}
    <p class="ending-footnote">${solved ? 'These tests identify the two preparations in this case.' : 'Your notes and measurements are still on the desk.'}</p>
    <div class="ending-actions"><button id="ending-return" class="primary">${solved ? 'Return to the museum' : open ? 'Continue investigating' : 'Try again'}</button>${!solved ? '<button id="ending-evidence" class="secondary">Review evidence</button>' : ''}</div>
  </div>`;
}
