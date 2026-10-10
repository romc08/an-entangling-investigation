import { summarizeCounts } from '../evidence.js';

// Authored, deterministic interface fixtures. These are NOT Qiskit results.
export function createSampleAdapter({ fail = false, delay = 450 } = {}) {
  return {
    label: 'Development preview — sample data',
    async load() {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (fail) throw Error('Development adapter: simulated execution failure. Reload /dev/ without ?fail=1 to recover.');
      const settings = { zz: [0, 0], xx: [90, 90], chsh00: [0, 45], chsh01: [0, -45], chsh10: [90, 45], chsh11: [90, -45] };
      const fixtures = {
        bell: { zz: [258, 0, 0, 254], xx: [251, 0, 0, 261], chsh00: [219, 38, 37, 218], chsh01: [218, 37, 38, 219], chsh10: [219, 37, 38, 218], chsh11: [38, 218, 219, 37] },
        mixture: { zz: [512, 0, 0, 512], xx: [259, 250, 254, 261], chsh00: [437, 75, 75, 437], chsh01: [437, 75, 75, 437], chsh10: [256, 256, 256, 256], chsh11: [256, 256, 256, 256] },
      };
      const bank = {};
      for (const [source, rows] of Object.entries(fixtures)) {
        bank[source] = {};
        for (const [id, values] of Object.entries(rows)) {
          const counts = Object.fromEntries(['00', '01', '10', '11'].map((key, i) => [key, values[i] * (source === 'bell' ? 2 : 1)]));
          bank[source][id] = { test_id: id, settings: { left: settings[id][0], right: settings[id][1] },
            counts, branch_shots: [512, 512], statistics: summarizeCounts(counts) };
        }
      }
      return { schema_version: 1, bank, provenance: { kind: 'development-sample', label: 'Development preview — sample data' } };
    },
  };
}
