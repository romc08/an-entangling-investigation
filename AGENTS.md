# Project instructions

- Keep this a small, buildless HTML/CSS/JavaScript game with Python/Qiskit quantum work.
- `index.html` is body markup for Qollab; `main.js` alone imports Python by dotted name. Qollab injects `backend`; never construct one in production code. Use `.callPromising`.
- `dev/index.html` and `dev/main.js` use the shared UI with explicit sample data. No Python imports may enter that dependency graph.
- One session, one result bank, one backend job containing all 24 circuits. Repeat Bell twice per setting to match the mixture's combined shot total and avoid a shot-count clue. Never retry automatically or silently substitute samples. Stop and Run again after a Qollab failure.
- Keep hidden truth and the result bank inside `game.js` closures. Trace gets only discovered evidence and progress. No browser storage or external chatbot.
- `workbench.js` owns apparatus selection and readout locking; it only uncovers existing records, never submits jobs. Skip and animation-end must be idempotent. Preserve native button hit targets when replacing CSS placeholder graphics.
- Notebook, Trace and report use native dialog overlays with Escape/focus return. Observation and reasoning tiles are explicit player choices; personal prose is optional. Keep Play → workbench direct until the cutscene stage is requested.
- Qubit 0 = Left, qubit 1 = Right; reverse Qiskit's `c1c0` count keys once in Python. UI keys always mean Left then Right.
- Mixture = separately measured 00 and 11 branches with equal shots; combine counts and report their actual total. Never use a coherent superposition or ancilla.
- Z/Z and X/X distinguish the specified candidates, not all entangled states. CHSH needs uncertainty and stated assumptions; low S does not prove separability.
- Preserve the existing MIT license and attribution: This effort is supported by Qollab & IonQ.
- Commands (PowerShell): `python -m http.server 8000 --bind 127.0.0.1` then open `/dev/`; `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`; `node --test tests/game.test.mjs` (Node 22.7+).
- Use focused deterministic checks and update README verification status honestly. Platform execution must be tested on Qollab; mocks are not platform validation.
