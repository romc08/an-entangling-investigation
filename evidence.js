export const TESTS = Object.freeze({
  zz: { name: 'Z/Z · Original view', left: 0, right: 0, purpose: 'Do the two outputs match in their original setting?' },
  xx: { name: 'X/X · Rotated view', left: 90, right: 90, purpose: 'Does the matching pattern survive a change of setting?' },
});
export const PREDICTIONS = Object.freeze({
  matching: 'Mostly matching outputs (00 and 11)',
  mixed: 'Matching and differing outputs about equally',
  unsure: 'I’m unsure — I want to compare the pattern',
});
export const OUTCOMES = ['00', '01', '10', '11'];

// Explicit player choices; these are never inserted as invented player prose.
export const CLAIMS = Object.freeze({
  matching: 'Matching outputs dominate this view.',
  half: 'About half of the outputs match.',
  unresolved: 'This record alone does not identify the preparation.',
});
export const REPORT_REASONS = Object.freeze({
  compare: 'The X/X comparison distinguishes the two candidate preparations.',
  limited: 'The evidence is incomplete or too ambiguous to identify a device.',
});
export const hasInterpretation = row => Boolean(row.claim || row.interpretation?.trim());

export function checkClaim(row, claim) {
  if (!Object.hasOwn(CLAIMS, claim)) throw Error('Choose an observation for this record.');
  const [low, high] = row.statistics.match_interval;
  if (claim === 'matching' && low <= .5) throw Error('Matching does not clearly dominate: the sampling interval reaches 50% or below. Compare the two kinds of output again.');
  if (claim === 'half' && !(low <= .5 && high >= .5)) throw Error('The sampling interval does not include 50%. Check the matching fraction before pinning that observation.');
  return claim;
}

export function summarizeCounts(counts) {
  if (!counts || Object.keys(counts).some(key => !OUTCOMES.includes(key))) throw Error('Unexpected count keys.');
  for (const key of OUTCOMES) {
    if (!Number.isSafeInteger(counts[key]) || counts[key] < 0) throw Error('Counts must be nonnegative integers.');
  }
  const shots = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(shots) || shots < 1) throw Error('No valid measurement shots were returned.');
  const matching = counts['00'] + counts['11'];
  const p = matching / shots;
  const radius = Math.sqrt(Math.log(40) / (2 * shots));
  const interval = [Math.max(0, p - radius), Math.min(1, p + radius)];
  return { shots, matching, differing: shots - matching, match_rate: p, correlation: 2 * p - 1,
    match_interval: interval, correlation_interval: interval.map(x => 2 * x - 1), confidence: .95,
    uncertainty_method: 'Hoeffding; independent shots; sampling uncertainty only' };
}

export function validateBank(payload) {
  if (payload?.schema_version !== 1 || !['selected-backend', 'development-sample'].includes(payload.provenance?.kind)
      || typeof payload.provenance.label !== 'string') throw Error('Invalid result-bank format or provenance.');
  const settings = { ...TESTS, chsh00: { left: 0, right: 45 }, chsh01: { left: 0, right: -45 },
    chsh10: { left: 90, right: 45 }, chsh11: { left: 90, right: -45 } };
  for (const source of ['bell', 'mixture']) {
    for (const [id, setting] of Object.entries(settings)) {
      const row = payload.bank?.[source]?.[id];
      if (!row || row.test_id !== id || row.settings?.left !== setting.left || row.settings?.right !== setting.right) {
        throw Error('The batch is incomplete or its measurement settings do not match the case.');
      }
      const stats = summarizeCounts(row.counts);
      const expectedBranches = 2;
      if (!Array.isArray(row.branch_shots) || row.branch_shots.length !== expectedBranches
          || row.branch_shots.some(n => !Number.isSafeInteger(n) || n < 1)
          || new Set(row.branch_shots).size !== 1 || row.branch_shots.reduce((a, b) => a + b, 0) !== stats.shots) {
        throw Error('Invalid or unequal branch shot totals.');
      }
      for (const key of ['shots', 'match_rate', 'correlation']) {
        if (!Number.isFinite(row.statistics?.[key]) || Math.abs(row.statistics[key] - stats[key]) > 1e-9) {
          throw Error('Returned statistics disagree with the observed counts.');
        }
      }
      if (!Array.isArray(row.statistics.match_interval) || row.statistics.match_interval.length !== 2
          || row.statistics.match_interval.some((n, i) => !Number.isFinite(n) || Math.abs(n - stats.match_interval[i]) > 1e-9)) {
        throw Error('Returned sampling interval disagrees with the counts.');
      }
      row.statistics = stats;
    }
  }
  return payload;
}

export function makeEvidence(device, testId, row, provenance, prediction) {
  return { id: `${device}-${testId}`, device, test_id: testId, settings: { ...row.settings },
    counts: { ...row.counts }, statistics: { ...row.statistics }, branch_shots: [...row.branch_shots],
    provenance: { ...provenance }, prediction, interpretation: '', claim: null };
}

export function assessReport(report, evidence) {
  if (!['A', 'B', 'insufficient'].includes(report.conclusion)) throw Error('Choose a conclusion.');
  if (report.reasoningId) {
    const expected = report.conclusion === 'insufficient' ? 'limited' : 'compare';
    if (report.reasoningId !== expected) throw Error('Choose reasoning that agrees with your conclusion.');
  } else if (typeof report.reasoning !== 'string' || report.reasoning.trim().length < 20) {
    throw Error('Choose a reasoning tile or explain your reasoning in at least 20 characters.');
  }
  const cited = evidence.filter(row => report.citations?.includes(row.id) && hasInterpretation(row));
  if (!cited.length) throw Error('Cite at least one evidence record with a saved interpretation.');
  if (report.conclusion === 'insufficient') return { title: 'An open case is a valid finding.',
    message: 'You recorded a limit to your conclusion. Identify what is missing or ambiguous in your reasoning. You can return to the workbench and revise this report.' };
  const xx = ['A', 'B'].map(device => cited.find(row => row.device === device && row.test_id === 'xx'));
  if (xx.some(row => !row)) throw Error('To identify a device, cite interpreted X/X evidence from both devices. Z/Z alone cannot distinguish these candidates.');
  const chosen = xx[report.conclusion === 'A' ? 0 : 1];
  const other = xx[report.conclusion === 'A' ? 1 : 0];
  const chosenRange = chosen.statistics.match_interval;
  const otherRange = other.statistics.match_interval;
  // The intervals must separate and contain the ideal candidate predictions.
  const supports = chosenRange[0] > otherRange[1] && chosenRange[1] === 1
    && otherRange[0] <= .5 && otherRange[1] >= .5;
  return supports ? { title: 'Your evidence supports this identification.',
    message: `Device ${report.conclusion} keeps the matching pattern in X/X, while the other is consistent with roughly half matching. This supports the Bell candidate in this case; it is not a universal test for entanglement.` }
    : { title: 'Revisit the strength of this conclusion.',
      message: 'The cited patterns do not clearly support that identification under the two ideal candidate models. Check which device retains matching outputs, consider noise and sampling uncertainty, or report insufficient evidence.' };
}
