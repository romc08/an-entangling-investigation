import { mountGame } from '../ui.js';
import { createSampleAdapter } from './sample-adapter.js';

// ?fail=1 exercises the failure screen without sending a quantum job.
mountGame(document.getElementById('app'), createSampleAdapter({ fail: new URLSearchParams(location.search).has('fail') }));
