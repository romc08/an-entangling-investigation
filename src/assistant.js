// Trace has no adapter, hidden assignment, or undiscovered result-bank access.
export function createTrace() {
  const levels = {};
  return function hint(intent, { evidence, status = 'ready', selectedDevice = 'A', selectedTest = 'zz' }) {
    const key = `${intent}:${status}:${evidence.length}:${selectedDevice}:${selectedTest}`;
    const level = Math.min(levels[key] || 0, 2);
    levels[key] = level + 1;
    const row = evidence.find(item => item.device === selectedDevice && item.test_id === selectedTest)
      || [...evidence].reverse().find(item => item.device === selectedDevice) || evidence.at(-1);
    const missing = ['A', 'B'].flatMap(device => ['zz', 'xx'].map(test => ({ device, test })))
      .find(item => !evidence.some(e => e.device === item.device && e.test_id === item.test));
    let steps;
    if (status === 'failed') steps = [
      'The lab batch failed, so there are no measurements to interpret. No sample evidence has been substituted.',
      'What does the error message above the workbench say about restarting this run?',
      'In Qollab, press Stop, then Run and choose the built-in simulator to debug. For the development failure demo, reload /dev/ without ?fail=1.',
    ];
    else if (status === 'loading') steps = [
      'The lab is collecting all preset measurements together. Nothing has been uncovered yet.',
      'While the job runs, which setting would you investigate first, and what do you expect?',
      'Keep this run open until the batch is ready. You can then record a prediction and uncover a result without sending another job.',
    ];
    else if (!row) steps = [
      'No evidence has been uncovered. A device label is not evidence about its preparation.',
      'What would matching outputs in the original setting tell you, if both candidates can produce them?',
      'Choose a device and Z/Z, record a prediction, then uncover its result. Compare with the other device before changing settings.',
    ];
    else if (intent === 'challenge') steps = [
      'Matching outputs can arise from an ordinary shared preparation: both 0 or both 1.',
      'Does your theory explain the evidence after changing the measurement setting, or only in Z/Z?',
      'Compare X/X records from both devices. For these candidates, the Bell preparation ideally keeps matching; the equal ordinary mixture matches only about half the time. Allow for uncertainty.',
    ];
    else if (intent === 'explain') steps = [
      `Device ${row.device}, ${row.test_id.toUpperCase()}: ${row.statistics.matching} of ${row.statistics.shots} outcomes match. The first digit is Left; the second is Right.`,
      row.test_id === 'zz' ? 'Both candidate preparations predict matching Z/Z outputs. Can this record alone identify the source?'
        : 'Compare this matching fraction with the other device’s X/X record. Is the difference larger than the sampling intervals?',
      row.test_id === 'zz' ? 'Z/Z establishes the shared pattern, but leaves the candidates unresolved. X/X gives a useful comparison.'
        : 'For X/X, the ideal Bell candidate predicts all matching and the mixture predicts half matching. Sampling bounds describe random variation, not device noise or every possible state.',
    ];
    else steps = [
      missing ? 'There are still unopened measurements in the lab batch.' : 'All four records are uncovered. Your interpretations are the remaining part of the evidence.',
      missing ? 'Which unopened setting would test an assumption in your current theory?' : 'Can you explain why Z/Z was insufficient and which X/X comparison supports your conclusion?',
      missing ? `Try Device ${missing.device} in ${missing.test.toUpperCase()}. Predict first, then compare the counts with your expectation.`
        : 'Mark your observations, then move the evidence cards onto the final report and cite them. Cards filed in the notebook can be returned to the desk. Choose insufficient evidence if the patterns remain ambiguous.',
    ];
    return { stage: ['Observation', 'Question', 'Suggestion'][level], text: steps[level] };
  };
}
