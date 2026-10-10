import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../game.js';
import { createWorkbench } from '../workbench.js';
import { createTrace } from '../assistant.js';
import { summarizeCounts, validateBank, assessReport } from '../evidence.js';
import { createQollabAdapter } from '../qollab-adapter.js';
import { createSampleAdapter } from '../dev/sample-adapter.js';

const sample = () => createSampleAdapter({ delay: 0 });
async function ready(random = () => 0) {
  const game = createGame(sample(), random);
  game.start();
  await game.load();
  return game;
}
function interpreted(game, device, id) {
  const row = game.reveal(device, id, 'unsure');
  game.interpret(row.id, 'The pattern needs comparison with the other setting.');
  return row;
}

test('assignment is drawn once, fixed, private; snapshots cannot mutate progress', async () => {
  let draws = 0;
  const game = await ready(() => { draws++; return .9; });
  assert.equal(draws, 1);
  assert.deepEqual(Object.keys(game.snapshot()).sort(), ['error', 'evidence', 'phase', 'report', 'status']);
  assert.equal(game.reveal('B', 'xx', 'matching').statistics.match_rate, 1);
  assert.ok(game.reveal('A', 'xx', 'mixed').statistics.match_rate < .6);
  const snapshot = game.snapshot();
  snapshot.evidence[0].counts['00'] = 99999;
  assert.notEqual(game.snapshot().evidence[0].counts['00'], 99999);
});

test('loading and duplicate clicks cannot duplicate jobs or reveal without a prediction', async () => {
  let calls = 0;
  let release;
  const game = createGame({ load: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const pending = game.load();
  assert.equal(game.snapshot().status, 'loading');
  assert.equal(game.load(), pending);
  assert.throws(() => game.reveal('A', 'zz', 'matching'), /Wait/);
  release(await sample().load());
  await pending;
  assert.equal(calls, 1);
  assert.throws(() => game.reveal('A', 'zz', ''), /prediction/);
  const row = game.reveal('A', 'zz', 'unsure');
  assert.deepEqual(game.reveal('A', 'zz', 'matching'), row);
  assert.equal(game.snapshot().evidence.length, 1);
});

test('failure is terminal for this run, explains restart, and never supplies samples', async () => {
  let calls = 0;
  const game = createGame({ load: async () => { calls++; throw Error('Backend unavailable'); } });
  await game.load(); await game.load();
  assert.equal(calls, 1);
  assert.equal(game.snapshot().status, 'failed');
  assert.match(game.snapshot().error, /Stop, then Run/);
  assert.deepEqual(game.snapshot().evidence, []);
  assert.throws(() => game.reveal('A', 'zz', 'matching'));
});

test('reports need interpreted evidence, both X/X records for identification, and reasoning', async () => {
  const game = await ready();
  const report = { conclusion: 'A', citations: ['A-xx', 'B-xx'], reasoning: 'A retains matching while B becomes approximately uniform in X/X.' };
  assert.throws(() => game.submitReport(report), /at least one/);
  interpreted(game, 'A', 'xx');
  assert.throws(() => game.submitReport(report), /both devices/);
  interpreted(game, 'B', 'xx');
  assert.match(game.submitReport(report).title, /supports/);
  assert.match(game.submitReport({ ...report, conclusion: 'B' }).title, /Revisit/);
  const noisy = game.snapshot().evidence;
  noisy[0].counts = { '00': 460, '01': 50, '10': 50, '11': 464 };
  noisy[0].statistics = summarizeCounts(noisy[0].counts);
  assert.match(assessReport(report, noisy).title, /Revisit/);
  assert.throws(() => game.submitReport({ ...report, reasoning: '' }), /20 characters/);
  game.interpret('A-xx', 'A corrected interpretation after looking again.');
  assert.equal(game.snapshot().report, null);
});

test('insufficient evidence is valid with a Z/Z record; Z/Z cannot identify a device', async () => {
  const game = await ready();
  interpreted(game, 'A', 'zz');
  const report = { conclusion: 'insufficient', citations: ['A-zz'], reasoning: 'Both candidate preparations predict this same Z/Z pattern.' };
  assert.match(game.submitReport(report).title, /open case/);
  assert.throws(() => game.submitReport({ ...report, conclusion: 'A' }), /both devices/);
});

test('Trace advances through three stages, uses discovered evidence only', async () => {
  const trace = createTrace();
  const context = { evidence: [], selectedDevice: 'A' };
  assert.equal(trace('challenge', context).stage, 'Observation');
  assert.equal(trace('challenge', context).stage, 'Question');
  assert.equal(trace('challenge', context).stage, 'Suggestion');
  const a = await ready(() => 0);
  const b = await ready(() => 1);
  // Empty evidence cannot reveal different hidden assignments.
  assert.deepEqual(createTrace()('next', a.snapshot()), createTrace()('next', b.snapshot()));
  const row = interpreted(a, 'A', 'zz');
  assert.match(createTrace()('explain', { evidence: [row] }).text, /Device A, ZZ: 1024 of 1024/);
  interpreted(a, 'A', 'xx');
  assert.match(createTrace()('explain', { evidence: a.snapshot().evidence, selectedDevice: 'A', selectedTest: 'zz' }).text, /Device A, ZZ:/);
  assert.match(createTrace()('next', { evidence: [], status: 'failed' }).text, /batch failed/);
  assert.match(createTrace()('next', { evidence: [], status: 'loading' }).text, /collecting/);
});

test('data contract validates missing tests, actual totals, statistics and intervals', async () => {
  const payload = await sample().load();
  assert.equal(validateBank(payload).schema_version, 1);
  for (const mutate of [p => delete p.bank.bell.xx, p => p.bank.mixture.xx.branch_shots[0]++,
    p => p.bank.bell.zz.statistics.shots++, p => p.bank.bell.zz.statistics.match_interval[0] = 1,
    p => p.provenance.kind = 'unknown', p => p.bank.bell.zz.settings.left = 90]) {
    const altered = structuredClone(payload); mutate(altered);
    assert.throws(() => validateBank(altered));
  }
  for (const counts of [{}, { '00': 0, '01': 0, '10': 0, '11': 0 }, { '00': -1 }, { '00': .5 }]) {
    assert.throws(() => summarizeCounts(counts));
  }
});

test('Qollab adapter uses async bridge once, selected backend, JSON and proxy cleanup', async () => {
  const payload = await sample().load();
  const selected = { id: 'chosen' };
  let calls = 0, destroyed = 0;
  const adapter = createQollabAdapter({ run_case_json: { callPromising: async (backend, shots) => {
    calls++; assert.equal(backend, selected); assert.equal(shots, 512);
    return { toJs: () => JSON.stringify(payload), destroy: () => destroyed++ };
  } } }, selected);
  const [a, b] = await Promise.all([adapter.load(), adapter.load()]);
  assert.deepEqual(a, payload); assert.equal(a, b); assert.equal(calls, 1); assert.equal(destroyed, 1);
});

test('Qollab adapter caches a rejected promise and rejects malformed JSON', async () => {
  let calls = 0;
  const adapter = createQollabAdapter({ run_case_json: { callPromising: async () => { calls++; return 'not json'; } } }, {});
  await assert.rejects(adapter.load());
  await assert.rejects(adapter.load());
  assert.equal(calls, 1);
});

test('workbench seals results until readout finishes and locks apparatus during readout', async () => {
  let calls = 0;
  const game = createGame({ load: () => { calls++; return sample().load(); } }, () => 0);
  const bench = createWorkbench(game);
  assert.throws(() => bench.predict('matching'), /device/);
  assert.throws(() => bench.selectDevice('C'), /Device/);
  assert.throws(() => bench.selectTest('chsh00'), /settings/);
  bench.selectDevice('A');
  bench.predict('matching');
  assert.throws(() => bench.beginReadout(), /not ready/);
  await game.load();
  bench.beginReadout();
  assert.equal(bench.snapshot().result, null);
  assert.equal(game.snapshot().evidence.length, 0);
  for (const action of [() => bench.selectDevice('B'), () => bench.selectTest('xx'),
    () => bench.predict('mixed'), () => bench.beginReadout()]) assert.throws(action, /Finish or skip/);
  const result = bench.finishReadout();
  assert.equal(result.id, 'A-zz');
  assert.deepEqual(bench.finishReadout(), result);
  assert.equal(game.snapshot().evidence.length, 1);
  assert.equal(calls, 1);
  assert.throws(() => bench.predict('mixed'), /locked/);
  assert.throws(() => bench.beginReadout(), /unopened/);
});

test('changing device or view requires a fresh prediction; revisiting retains the original', async () => {
  const game = await ready();
  const bench = createWorkbench(game);
  bench.selectDevice('A'); bench.predict('unsure');
  bench.selectTest('xx');
  assert.equal(bench.snapshot().prediction, null);
  assert.throws(() => bench.beginReadout(), /prediction/);
  assert.throws(() => bench.predict('invalid'), /token/);
  bench.predict('matching'); bench.beginReadout(); bench.finishReadout();
  bench.selectDevice('B');
  assert.equal(bench.snapshot().prediction, null);
  assert.equal(bench.snapshot().result, null);
  bench.selectDevice('A');
  assert.equal(bench.snapshot().result.prediction, 'matching');
  bench.snapshot().result.counts['00'] = 0;
  assert.ok(bench.snapshot().result.counts['00'] > 0);
});

test('pinned observations are explicit, checked against evidence, and enable reports without typing', async () => {
  const game = await ready();
  assert.throws(() => game.recordClaim('A-xx', 'matching'), /Uncover/);
  game.reveal('A', 'xx', 'mixed'); // A mistaken prediction does not penalize discovery.
  game.reveal('B', 'xx', 'matching');
  const report = { conclusion: 'A', citations: ['A-xx', 'B-xx'], reasoningId: 'compare', reasoning: '' };
  assert.throws(() => game.submitReport(report), /at least one/);
  assert.throws(() => game.recordClaim('A-xx', 'half'), /50%/);
  assert.equal(game.snapshot().evidence[0].claim, null);
  assert.throws(() => game.recordClaim('A-xx', 'invalid'), /observation/);
  assert.throws(() => game.recordClaim('B-xx', 'matching'), /dominate/);
  game.recordClaim('A-xx', 'matching'); game.recordClaim('B-xx', 'half');
  assert.match(game.submitReport(report).title, /supports/);
  assert.throws(() => game.submitReport({ ...report, reasoningId: 'limited' }), /agrees/);
  assert.throws(() => game.submitReport({ ...report, reasoningId: 'invented' }), /agrees/);
  game.recordClaim('A-xx', 'unresolved');
  assert.equal(game.snapshot().report, null);
  assert.match(game.submitReport({ conclusion: 'insufficient', citations: ['A-xx'], reasoningId: 'limited' }).title, /open case/);
});
