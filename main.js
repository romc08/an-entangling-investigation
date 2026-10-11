// This is the Qollab entry point, not the local browser entry point.
import * as experiments from 'quantum.experiments';
import { createQollabAdapter } from './src/qollab-adapter.js';
import { mountGame } from './src/ui.js';

// Qollab injects backend from its Select QPU dialog.
mountGame(document.getElementById('app'), createQollabAdapter(experiments, backend));
