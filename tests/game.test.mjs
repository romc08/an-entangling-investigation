import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { createWorkbench } from '../src/workbench.js';
import { createTrace } from '../src/assistant.js';
import { summarizeCounts, validateBank, assessReport } from '../src/evidence.js';
import { createQollabAdapter } from '../src/qollab-adapter.js';
import { createSampleAdapter } from '../dev/sample-adapter.js';
import { inspectionDistribution, inspectionPanel } from '../src/inspection.js';

test('inspection sums asymmetric Left/Right counts without reversing bits or losing shots', () => {
  const counts = Object.freeze({ '00': 1, '01': 2, '10': 3, '11': 4 });
  assert.deepEqual(inspectionDistribution(counts, 'left').map(x => x.count), [3, 7]);
  assert.deepEqual(inspectionDistribution(counts, 'right').map(x => x.count), [4, 6]);
  assert.deepEqual(inspectionDistribution(counts).map(x => x.count), [1, 2, 3, 4]);
  for (const view of ['left', 'right', 'together']) {
    assert.equal(inspectionDistribution(counts, view).reduce((sum, x) => sum + x.count, 0), 10);
    assert.ok(Math.abs(inspectionDistribution(counts, view).reduce((sum, x) => sum + x.fraction, 0) - 1) < 1e-12);
  }
  assert.throws(() => inspectionDistribution({ '00': 0, '01': 0, '10': 0, '11': 0 }), /No valid/);
  assert.throws(() => inspectionDistribution({ ...counts, '00': -1 }), /nonnegative/);
  assert.throws(() => inspectionDistribution(counts, 'unknown'), /Unknown/);
});

test('inspection uses discovered evidence without changing filing, drafts or submitting a job', async () => {
  let calls = 0;
  const game = createGame({ load: () => { calls++; return sample().load(); } }, () => 0);
  game.start(); await game.load();
  const row = game.reveal('A', 'xx', 'matching');
  game.interpret(row.id, 'Matching persists in the rotated view.');
  game.moveEvidence(row.id, 'notebook');
  const before = game.snapshot();
  for (const view of ['left', 'right', 'together']) {
    const html = inspectionPanel(before.evidence[0], view);
    assert.match(html, /Development sample/);
    assert.match(html, /Laboratory record/);
    assert.doesNotMatch(html, /CNOT|source.*bell|bank/i);
  }
  assert.deepEqual(game.snapshot(), before);
  assert.equal(calls, 1);
  const untrusted = { ...row, provenance: { kind: 'selected-backend', label: '<img src=x>' } };
  assert.match(inspectionPanel(untrusted), /&lt;img src=x&gt;/);
});

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
  game.moveEvidence(row.id, 'report');
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
  assert.throws(() => game.submitReport(report), /Move the cited/);
  interpreted(game, 'A', 'xx');
  assert.throws(() => game.submitReport({ ...report, citations: ['A-xx'] }), /both devices/);
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
  game.moveEvidence('A-xx', 'report'); game.moveEvidence('B-xx', 'report');
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

// The cinematic shell cannot duplicate the lab start or desk entry.
import { createOpeningFlow } from '../src/scenes.js';
import { parts, byteLength, sha256 } from '../assets/media/intro.js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';

test('production and preview imports resolve within the organized project', () => {
  const root = new URL('../', import.meta.url);
  function graph(entry) {
    const seen = new Set();
    function visit(file) {
      assert.ok(file.href.startsWith(root.href), 'Import leaves the project');
      if (seen.has(file.href)) return;
      seen.add(file.href);
      const source = readFileSync(file, 'utf8');
      for (const [, path] of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
        if (path.startsWith('.')) visit(new URL(path, file));
        else {
          assert.equal(file.href, new URL('main.js', root).href);
          assert.equal(path, 'quantum.experiments');
        }
      }
    }
    visit(new URL(entry, root));
    return seen;
  }
  const production = graph('main.js');
  const preview = graph('dev/main.js');
  for (const path of ['src/ui.js', 'assets/art/evidence1.js', 'assets/media/intro.js']) {
    assert.ok(production.has(new URL(path, root).href));
    assert.ok(preview.has(new URL(path, root).href));
  }
  assert.ok(!preview.has(new URL('main.js', root).href));
  assert.ok(!preview.has(new URL('src/qollab-adapter.js', root).href));
});

function openingHarness(overrides = {}) {
  const calls = [];
  const effects = Object.fromEntries(['onStart', 'fadePlay', 'playFilm', 'stopFilm', 'fadeFilm', 'enterDesk', 'revealDesk', 'blocked'].map(name => [name, () => { calls.push(name); }]));
  return { calls, flow: createOpeningFlow({ ...effects, ...overrides }) };
}
test('Play, skip and natural end are idempotent, with the expected fade order', async () => {
  const { calls, flow } = openingHarness();
  await flow.enter(); assert.deepEqual(calls, []);
  const first = flow.start(); assert.equal(flow.start(), first); await first;
  assert.equal(flow.phase(), 'film');
  const enter = flow.enter(); assert.equal(flow.enter(), enter); await enter;
  await flow.start(); await flow.enter();
  assert.deepEqual(calls, ['onStart', 'fadePlay', 'playFilm', 'stopFilm', 'fadeFilm', 'enterDesk', 'revealDesk']);
  assert.equal(flow.phase(), 'done');
});
test('skipping during the Play fade never starts the film afterward', async () => {
  let release;
  const { calls, flow } = openingHarness({ fadePlay: () => new Promise(resolve => { release = resolve; }) });
  const starting = flow.start(); await flow.enter(); release(); await starting;
  assert.ok(!calls.includes('playFilm'));
  assert.equal(calls.filter(c => c === 'enterDesk').length, 1);
});
test('blocked playback remains skippable; a late playback rejection cannot reopen controls', async () => {
  const a = openingHarness({ playFilm: async () => { throw Error('codec unavailable'); } });
  await a.flow.start(); assert.equal(a.flow.phase(), 'film'); assert.ok(a.calls.includes('blocked'));
  await a.flow.enter(); assert.equal(a.flow.phase(), 'done');
  let reject;
  const b = openingHarness({ playFilm: () => new Promise((_, no) => { reject = no; }) });
  const pending = b.flow.start(); await Promise.resolve();
  await b.flow.enter(); reject(Error('late play interruption')); await pending;
  assert.ok(!b.calls.includes('blocked'));
});
test('verdicts distinguish solved, revise, and inconclusive without recollecting data', async () => {
  let jobs = 0, draws = 0;
  const game = createGame({ load: () => { jobs++; return sample().load(); } }, () => { draws++; return 0; });
  await game.load(); game.start();
  interpreted(game, 'A', 'xx'); interpreted(game, 'B', 'xx');
  const report = { conclusion: 'B', citations: ['A-xx', 'B-xx'], reasoningId: 'compare' };
  assert.equal(game.submitReport(report).outcome, 'revise');
  assert.equal(game.submitReport({ ...report, conclusion: 'insufficient', reasoningId: 'limited' }).outcome, 'inconclusive');
  assert.equal(game.submitReport({ ...report, conclusion: 'A' }).outcome, 'solved');
  assert.equal(game.snapshot().evidence.length, 2);
  await game.load(); assert.equal(jobs, 1); assert.equal(draws, 1);
});
test('a misleading bank cannot award a win to the wrong authored device', async () => {
  const bank = await sample().load();
  [bank.bank.bell.xx, bank.bank.mixture.xx] = [bank.bank.mixture.xx, bank.bank.bell.xx];
  const game = createGame({ load: async () => bank }, () => 0);
  await game.load(); interpreted(game, 'A', 'xx'); interpreted(game, 'B', 'xx');
  const report = { conclusion: 'B', citations: ['A-xx', 'B-xx'], reasoningId: 'compare' };
  assert.equal(assessReport(report, game.snapshot().evidence).outcome, 'supported');
  assert.equal(game.submitReport(report).outcome, 'revise');
});
test('runtime media preserves the supplied film exactly; each asset module is below 2 MB', () => {
  const film = Buffer.concat(parts.map(part => Buffer.from(part, 'base64')));
  assert.equal(film.length, byteLength);
  assert.equal(createHash('sha256').update(film).digest('hex'), sha256);
  assert.deepEqual(film, readFileSync(new URL('../artwork/cutscenes/full_intro_cutscene.mp4', import.meta.url)));
  for (const directory of ['assets/art', 'assets/media']) {
    const folder = new URL(`../${directory}/`, import.meta.url);
    for (const name of readdirSync(folder)) assert.ok(statSync(new URL(name, folder)).size < 2_000_000, `${directory}/${name} exceeds the upload budget`);
  }
});

test('cards are numbered in discovery order, move without data loss, and gate report citations', async () => {
  let calls = 0;
  const game = createGame({ load: () => { calls++; return sample().load(); } }, () => 0);
  await game.load();
  const order = [['B', 'xx'], ['A', 'zz'], ['A', 'xx'], ['B', 'zz']];
  order.forEach(([device, testId], i) => {
    const row = game.reveal(device, testId, 'unsure');
    assert.equal(row.card.number, i + 1);
    assert.equal(row.card.location, 'desk');
    assert.equal(game.reveal(device, testId, 'matching').card.number, i + 1);
  });
  const original = game.snapshot().evidence[0];
  game.recordClaim('B-xx', 'half');
  game.interpret('B-xx', 'About half of this device’s outputs match.');
  const report = { conclusion: 'insufficient', citations: ['B-xx'], reasoningId: 'limited' };
  assert.throws(() => game.submitReport(report), /Move the cited/);
  game.moveEvidence('B-xx', 'notebook');
  assert.throws(() => game.submitReport(report), /Move the cited/);
  game.moveEvidence('B-xx', 'desk', { x: -1, y: 9 });
  let row = game.snapshot().evidence[0];
  assert.equal(row.card.x, .24); assert.equal(row.card.y, .78);
  assert.equal(row.claim, 'half'); assert.match(row.interpretation, /About half/);
  assert.deepEqual(row.counts, original.counts); assert.deepEqual(row.provenance, original.provenance);
  game.moveEvidence('B-xx', 'report');
  assert.equal(game.submitReport(report).outcome, 'inconclusive');
  game.moveEvidence('B-xx', 'desk');
  assert.equal(game.snapshot().report, null);
  assert.throws(() => game.submitReport(report), /Move the cited/);
  assert.throws(() => game.moveEvidence('missing', 'desk'), /Uncover/);
  assert.throws(() => game.moveEvidence('B-xx', 'hidden'), /Choose/);
  assert.throws(() => game.moveEvidence('B-xx', 'desk', { x: NaN, y: 0 }), /Invalid/);
  assert.equal(calls, 1); assert.equal(game.snapshot().evidence.length, 4);
});

import { createTypewriter } from '../src/typewriter.js';
test('Trace types one character, cancels stale lines, and supports instant/reduced-motion text', () => {
  let next = 0, text = '', completed = 0;
  const pending = new Map();
  const speech = createTypewriter({ write: value => { text = value; }, complete: () => completed++,
    schedule: callback => { pending.set(++next, callback); return next; }, cancel: id => pending.delete(id) });
  const tick = () => { const [id, callback] = pending.entries().next().value; pending.delete(id); callback(); };
  speech.start('A🔎B'); tick(); assert.equal(text, 'A'); tick(); assert.equal(text, 'A🔎');
  const stale = pending.values().next().value;
  speech.start('New'); stale(); assert.equal(text, '');
  tick(); assert.equal(text, 'N');
  tick(); tick(); assert.equal(text, 'New'); assert.equal(pending.size, 0);
  speech.start('Stopped'); speech.stop(); assert.equal(pending.size, 0);
  speech.start('Instant', true); assert.equal(text, 'Instant'); assert.equal(pending.size, 0);
  speech.start('OK'); tick(); tick(); assert.equal(text, 'OK'); assert.equal(pending.size, 0);
  assert.equal(completed, 3);
});
