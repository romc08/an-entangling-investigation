# an-entangling-investigation

A point-and-click quantum detective game. The sprite workbench fills the project
window: examine either device, open the evidence notebook, call Trace on the
phone, and assemble a supported final report.

**This effort is supported by Qollab & IonQ.**

## Local preview

From this folder in PowerShell:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/dev/**. This uses explicitly labeled development
sample data, not Qiskit execution. No installation or build is needed for the
preview. Ctrl+C stops the server. Use `py` if your Python launcher requires it.

Click a device sprite to open its analyzer. Choose a view and prediction, then
pull the lever. Inspect the result, pin an observation, and compare evidence in
the notebook. The report needs supporting evidence; “insufficient evidence” is
a valid conclusion. Tab and Enter/Space work on objects; Escape closes a panel
and restores focus. Closing a device during its readout does not lose the result.
Reloading clears this session and randomizes the device assignment again.

## Runtime files and artwork

- `ui.js`, `main.css`: full-window sprite scene and retro instrument/paper panels.
- `game.js`, `workbench.js`, `evidence.js`, `assistant.js`: investigation rules,
  private case truth, readout state, evidence and scripted Trace hints.
- `assets.js`, **all five `art/*.js` files**: embedded sprite/background images.
- `main.js`, `qollab-adapter.js`, `quantum/`: the real Qollab/Qiskit execution path.
- `dev/`: local entry point and sample adapter, with no Python imports.

The original `sprites/` files are preserved. Several are larger than Qollab's
file limit; upload the packaged `art/` modules instead. Every runtime module is
below 2 MB, including encoded image data. No external fonts or relative image
fetches are used. Artwork notes are in [ART_CREDITS.md](ART_CREDITS.md).

`dev/package_sprites.py` is an optional maintenance command for changed artwork,
using Python with Pillow installed. The generated files are already included;
neither Pillow nor an asset build is needed to play or upload the game.

## Qollab upload and checks

Upload the root `index.html`, `main.js`, `main.css`, `ui.js`, `workbench.js`,
`game.js`, `evidence.js`, `assistant.js`, `qollab-adapter.js`, `assets.js`,
`requirements.txt`, the complete `art/` and `quantum/` folders, and project
documentation/license. Omit `sprites/`, `dev/`, tests, `.git` and `.venv`.

Qollab loads body markup from `index.html` and executes `main.js`. Press Run,
choose a backend, then Play investigation. The selected backend is passed through
the asynchronous Python bridge; one job collects all 24 circuits. Opening a
device only reveals stored results. Failures never substitute samples or retry;
Stop → Run starts a fresh Qollab session.

**Qollab validation is still pending.** On the built-in simulator and then an
IonQ remote simulator, check module imports, embedded WebP decoding, full-frame
layout, a single 24-circuit job, actual shot totals, provenance, and a complete
playthrough. Browser tests do not establish platform compatibility. The game
fills the project's viewport; the host application's surrounding chrome is
controlled by the host.

## Verification

```powershell
node --test tests/game.test.mjs
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Node 22.7+ is required. For a new Python environment, use `python -m venv .venv`
and `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` first.

- [x] Sprite workbench, device windows, notebook, phone/Trace and report.
- [x] 12 JavaScript checks pass; quantum construction/execution code unchanged.
- [x] Browser: four records, predictions, observations, comparison, Trace and both report routes.
- [x] Keyboard/focus return, skipped/closed readouts and narrow-window layouts checked.
- [ ] Actual Qollab built-in and IonQ remote-simulator validation.
- [ ] Museum transition/intro cutscene and further gameplay polish.

Z/Z and X/X distinguish the two specified candidate preparations; they are not
a universal entanglement test. All evidence displays actual counts and sampling
uncertainty. CHSH circuits/analysis remain implemented; their interface is deferred.

MIT code license; see [LICENSE](LICENSE) and [ART_CREDITS.md](ART_CREDITS.md).
