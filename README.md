# An Entangling Investigation

*Two devices. Missing labels. A museum exhibit waiting for your verdict.*

*An Entangling Investigation* is a browser-based, point-and-click detective game created for the Qollab × IonQ 48-hour quantum hackathon. Explore a pixel-art workbench, conduct experiments, and use evidence to solve a mystery about quantum entanglement. No prior quantum knowledge is required to begin.

## The case

The Museum of Unfinished Questions is preparing a new exhibit, but the identification records for its two most important devices have disappeared. One produces an entangled Bell pair. The other produces an ordinary correlated mixture (a preparation whose correlations have a classical explanation).

The museum has hired you, a quantum detective, to determine which is which and restore the exhibit labels before the opening.

At first, the devices may seem indistinguishable. Matching outputs alone are not enough to settle the case. You will need to change how you measure, compare the patterns, and decide what the evidence actually supports.

Your investigation takes place at an after-hours museum workbench. There is no timer to beat and no penalty for an incorrect prediction. Your task is to build a defensible conclusion.

## Your tools

- **Two unidentified devices:** Examine Device A and Device B, switch between the original Z/Z and rotated X/X measurement views, and predict what you expect before uncovering each result. Their appearance is not a clue; the hidden assignment is randomized once per session.
- **The instrument readout:** Inspect the observed outcomes and the proportion of matching measurements. Each result comes from the session's collected measurements.
- **Your field notebook:** Keep evidence, compare two records side by side, and mark observations. Add personal notes if you wish. Measurement settings, shot totals, uncertainty, predictions, and data provenance remain available in the record details.
- **A telephone to Trace:** Call your field assistant to challenge a theory, explain a result, or suggest a next step. Trace offers contextual, scripted hints based on what you have discovered, without knowing the hidden device assignment.
- **The final report:** Identify the Bell device, attach supporting evidence, and seal your finding. You may also conclude that the evidence is insufficient.

## How to play

Press **Play** to watch the introductory film, or skip straight to the desk. Click the objects on the workbench to use them.

**Examine → choose a measurement view → predict → uncover → compare → record an observation → report.**

The lab collects all preset measurements together in one batch; you choose the order in which to uncover and interpret them. The experiment controls reveal stored results rather than submitting a new job on every click.

A correct identification backed by evidence restores the labels and closes the case. An unsupported or incorrect finding returns the report for revision. An insufficient-evidence finding keeps the case open. You can continue investigating without losing your measurements or notes.

Use **Tab** to move between controls, **Enter/Space** to activate them, and **Escape** to close a window or skip the intro. The film also has pause and mute controls. Progress lasts for the current session only; reloading starts a new case.

## The science behind the mystery

The game explores the difference between ordinary correlation and entanglement using two specified preparations. Python and Qiskit construct the circuits, execute the measurement batch, and calculate the statistics; the browser presents those results as detective evidence.

The Bell preparation uses a Hadamard gate followed by CNOT. The ordinary mixture combines equal measurements of separate `|00⟩` and `|11⟩` product-state preparations. Both use two logical qubits, Left and Right.

The Z/Z and X/X comparison distinguishes these particular candidates; it is not a universal entanglement detector. CHSH circuits and uncertainty analysis are also implemented, with the fuller CHSH investigation planned for a later milestone. A low CHSH result does not prove a state is unentangled, and simulator results do not demonstrate quantum computational advantage.

## Development

The project uses plain HTML, CSS, and JavaScript for the game, with Python and Qiskit for quantum work. There is no frontend framework, database, or external chatbot. Source artwork is preserved; see [ART_CREDITS.md](ART_CREDITS.md) for asset information.

To prepare a local Python environment and run the checks:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
node --test tests/game.test.mjs
```

JavaScript checks require Node 22.7 or later.

## License and acknowledgement

Project code is available under the [MIT License](LICENSE). See the artwork credits for supplied media details.

**This effort is supported by Qollab & IonQ**.