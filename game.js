import { TESTS, PREDICTIONS, validateBank, makeEvidence, assessReport, checkClaim } from './evidence.js';

export function createGame(adapter, random = Math.random) {
  // Truth, undiscovered measurements, and player progress are separate.
  const truth = random() < .5 ? { A: 'bell', B: 'mixture' } : { A: 'mixture', B: 'bell' };
  let bank;
  let pending;
  const progress = { phase: 'intro', status: 'idle', evidence: [], error: '', report: null };
  const snapshot = () => JSON.parse(JSON.stringify(progress));
  return {
    snapshot,
    start() { progress.phase = 'workbench'; },
    load() {
      if (pending) return pending;
      progress.status = 'loading';
      pending = (async () => {
        try {
          bank = validateBank(await adapter.load());
          progress.status = 'ready';
        } catch (error) {
          progress.status = 'failed';
          progress.error = `${error.message || error} No sample data was substituted. In Qollab, press Stop, then Run again (choose the built-in simulator to debug). IonQ allows only one job per run, so this session cannot retry.`;
        }
        return snapshot();
      })();
      return pending;
    },
    reveal(device, testId, prediction) {
      if (progress.status !== 'ready') throw Error('Wait for the lab batch to finish.');
      if (!Object.hasOwn(truth, device) || !Object.hasOwn(TESTS, testId) || !Object.hasOwn(PREDICTIONS, prediction)) throw Error('Choose a device, test, and prediction first.');
      const old = progress.evidence.find(row => row.id === `${device}-${testId}`);
      if (old) return JSON.parse(JSON.stringify(old));
      const row = makeEvidence(device, testId, bank.bank[truth[device]][testId], bank.provenance, prediction);
      progress.evidence.push(row);
      return JSON.parse(JSON.stringify(row));
    },
    interpret(id, text) {
      const row = progress.evidence.find(item => item.id === id);
      if (!row || typeof text !== 'string' || text.trim().length < 10) throw Error('Write at least 10 characters about what the pattern suggests.');
      row.interpretation = text.trim().slice(0, 2000);
      progress.report = null;
    },
    recordClaim(id, claim) {
      const row = progress.evidence.find(item => item.id === id);
      if (!row) throw Error('Uncover this record before interpreting it.');
      row.claim = checkClaim(row, claim);
      progress.report = null;
    },
    submitReport(report) {
      const feedback = assessReport(report, progress.evidence);
      progress.report = { ...JSON.parse(JSON.stringify(report)), feedback };
      return feedback;
    },
  };
}
