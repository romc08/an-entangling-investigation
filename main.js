// This is the Qollab entry point, not the local browser entry point.
import * as experiments from 'quantum.experiments';
import { createQollabAdapter } from './qollab-adapter.js';
import { mountGame } from './ui.js';

// Qollab injects backend from its Select QPU dialog.
mountGame(document.getElementById('app'), createQollabAdapter(experiments, backend));
