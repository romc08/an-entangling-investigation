import { TESTS, PREDICTIONS } from './evidence.js';

// Interaction state never sees the private source assignment or result bank.
// Finishing a readout uncovers a collected record; it cannot submit a job.
export function createWorkbench(game) {
  let device = null;
  let testId = 'zz';
  let prediction = null;
  let reading = false;
  const current = () => game.snapshot().evidence.find(row => row.id === `${device}-${testId}`) || null;
  const editable = () => { if (reading) throw Error('Finish or skip the readout before changing the apparatus.'); };
  return {
    snapshot() { return { device, testId, prediction, reading, result: current() }; },
    selectDevice(id) {
      editable();
      if (!['A', 'B'].includes(id)) throw Error('Choose Device A or B.');
      if (id !== device) prediction = null;
      device = id;
    },
    selectTest(id) {
      editable();
      if (!Object.hasOwn(TESTS, id)) throw Error('Choose one of the two collected settings.');
      if (id !== testId) prediction = null;
      testId = id;
    },
    predict(id) {
      editable();
      if (!device) throw Error('Select a device first.');
      if (current()) throw Error('The prediction for an uncovered record is already locked.');
      if (!Object.hasOwn(PREDICTIONS, id)) throw Error('Choose a prediction token.');
      prediction = id;
    },
    beginReadout() {
      editable();
      if (game.snapshot().status !== 'ready') throw Error('The lab batch is not ready.');
      if (!device || !prediction || current()) throw Error('Choose a device, an unopened setting, and a prediction.');
      reading = true;
    },
    finishReadout() {
      if (!reading) return current(); // Skip and animation-end can race safely.
      const row = game.reveal(device, testId, prediction);
      reading = false;
      return row;
    },
  };
}
