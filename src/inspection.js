import { OUTCOMES, summarizeCounts } from './evidence.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const percent = value => `${(value * 100).toFixed(1)}%`;

// Only observed counts enter this projection. No preparation or hidden bank.
export function inspectionDistribution(counts, view = 'together') {
  const { shots } = summarizeCounts(counts);
  if (!['left', 'right', 'together'].includes(view)) throw Error('Unknown inspection view.');
  const keys = view === 'together' ? OUTCOMES : ['0', '1'];
  return keys.map(key => {
    const count = view === 'together' ? counts[key] : OUTCOMES
      .filter(pair => pair[view === 'left' ? 0 : 1] === key)
      .reduce((sum, pair) => sum + counts[pair], 0);
    return { key, count, fraction: count / shots };
  });
}

export function inspectionPanel(row, view = 'together') {
  const stats = row.statistics;
  const distribution = inspectionDistribution(row.counts, view);
  const joint = view === 'together';
  return `<div class="inspection-switch" role="group" aria-label="Inspect outputs">${['left', 'together', 'right'].map(mode => `<button type="button" data-inspection-view="${mode}" aria-pressed="${view === mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}</div>
    <div class="inspection-screen">
      <p class="inspection-axis">${joint ? 'LEFT / RIGHT' : `${view.toUpperCase()} OUTPUT`}</p>
      <div class="outcome-grid ${joint ? 'joint' : 'single'}" aria-label="Observed outcome counts">${distribution.map(item => `<div class="outcome-well ${joint && item.key[0] === item.key[1] ? 'matching' : ''}"><i aria-hidden="true" style="--fill:${100 * item.fraction}%"></i><b>${item.key}</b><span>${percent(item.fraction)}</span><small>${item.count} shots</small></div>`).join('')}</div>
      <p class="inspection-caption">${joint ? `<span class="amber-key">◆</span> Matching pairs · ${percent(stats.match_rate)}` : 'Same shots. One side of each pair.'}</p>
    </div>
    <p class="inspection-footnote">${joint ? 'Inspect each side alone. Then compare the pairs.' : 'A single output can hide a pattern shared by two.'}</p>
    <details class="inspection-slip"><summary>Laboratory record</summary>
      <dl><div><dt>Setting</dt><dd>${escape(row.test_id.toUpperCase().split('').join('/'))} · Left ${row.settings.left}° / Right ${row.settings.right}°</dd></div>
      <div><dt>Shots</dt><dd>${stats.shots} observed</dd></div>
      <div><dt>Correlation E</dt><dd>${stats.correlation.toFixed(3)}</dd></div>
      <div><dt>Matching · 95% interval</dt><dd>${stats.match_interval.map(percent).join(' – ')}</dd></div>
      <div><dt>Source</dt><dd>${row.provenance.kind === 'development-sample' ? 'Development sample' : 'Selected backend'} · ${escape(row.provenance.label)}</dd></div></dl>
      <p>E = (matching − differing) / shots. First digit: Left. Second: Right.</p>
      <p>Ry(−angle) before measurement. 0° = Z; 90° = X. Each shot starts fresh.</p>
      <p>95% Hoeffding interval: independent shots; sampling uncertainty only. These views distinguish this case’s two candidates, not all entangled states.</p>
    </details><button type="button" id="inspection-back" class="inspection-back">← Back to evidence</button>`;
}
