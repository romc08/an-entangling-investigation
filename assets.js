// Runtime copies are embedded: no fetch, CDN, or browser storage required.
import deviceA from './art/deviceA.js';
import deviceB from './art/deviceB.js';
import phone from './art/phone.js';
import notebook from './art/notebook.js';
import workbench from './art/workbench.js';

export const ART = Object.freeze({ deviceA, deviceB, phone, notebook, workbench });
