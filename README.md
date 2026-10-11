# An Entangling Investigation

*Can you disentangle this mystery?*

A pixel-art, point-and-click detective game made for the **Qollab × IonQ 48-hour quantum hackathon**. Learn about entanglement by investigating a mystery—no quantum background required.
Available to play on Qollab's website: https://qollab.xyz/u/romc08/an-entangling-investigation

## The case

The Museum of Unfinished Questions has hired you to identify two devices for its new exhibit. Their records have disappeared: one prepares an **entangled Bell pair**, while the other produces an **ordinary, classically correlated mixture**.

Both can give matching outputs. Change the measurement setting, gather evidence, and restore the labels. Device assignments are randomized once per session (their colors are not clues).

## At the workbench

Press **Play**, watch or skip the opening film, and explore the desk.

- **Devices A and B:** Choose **Z/Z** (original view) or **X/X** (rotated view), predict, and pull **Uncover**. Inspect the readout, then close the window. Incorrect predictions carry no penalty.
- **Evidence cards:** Each experiment leaves a numbered card on the mat. Click to inspect; drag into the notebook to file, or onto the report to cite. Buttons offer the same moves without dragging.
- **Notebook:** Compare two filed records, mark your observations, and optionally write personal notes. **Return to desk** takes a card back out.
- **Magnifying glass:** Drag onto a card, or click the glass then a card. Compare **Left**, **Right**, and **Together** outputs. **Laboratory record** reveals settings, counts, correlation, uncertainty, and backend provenance. Filed cards have an **Inspect closely** button.
- **Telephone:** Call **Trace** to challenge your theory, explain a result, or suggest a next step. These are scripted, contextual hints; Trace cannot see the hidden device assignment.
- **Final report:** Attach cards, select citations, choose a conclusion and reasoning, then **seal the report**. Identification requires interpreted X/X evidence from both devices. A supported, correct finding closes the case; otherwise revise or choose **insufficient evidence**.
- **Field guide:** A quick reminder of the investigation's controls and ideas.

**Predict → uncover → inspect → compare → interpret → conclude.**

Tab moves between controls, Enter/Space activates them, and Escape closes windows. Progress lasts for this session; reloading starts over.

## What is being simulated?

Python and **Qiskit** prepare two logical qubits, **Left** and **Right**, on the backend selected in Qollab:

- **Bell source:** A Hadamard gate followed by CNOT prepares `|Φ+⟩ = (|00⟩ + |11⟩)/√2`.
- **Ordinary source:** Separate `|00⟩` and `|11⟩` product-state circuits receive equal shots, then their counts are combined. This is a mixture, not a coherent superposition.

Each shot starts with a fresh preparation. Applying `Ry(−angle)` before measurement selects Z at 0° or X at 90°. Displayed bitstrings always mean **Left, then Right**.

| Ideal measurement pattern | Bell source | Ordinary mixture |
| --- | --- | --- |
| Z/Z | Half `00`, half `11` | Half `00`, half `11` |
| X/X | Half `00`, half `11` | All four outcomes equally likely |

Individual outputs look random; their correlations across settings distinguish the sources. Records show actual shot totals and 95% sampling intervals, assuming independent shots. These cover sampling fluctuations, not systematic device errors.

Play starts **one backend job containing 24 circuits**, requesting 512 shots per circuit. Each source/setting combines two circuits—normally 1,024 shots. Bell circuits repeat to match the mixture's total. Results stay in a session bank; you choose the investigation order without submitting more jobs.

The batch also computes **CHSH** correlations and uncertainty using Left 0°/90° and Right 45°/−45°. The ideal Bell value is `2√2`, beyond the classical expectation bound of 2 under CHSH assumptions. These calculations run in the background; the playable investigation currently uses Z/Z and X/X.

Z/Z and X/X distinguish this case's specified candidates, not every entangled state. A low CHSH result does not prove separability, and simulator results do not demonstrate quantum computational advantage.

## About the project

Built with plain HTML, CSS, JavaScript, Python, and Qiskit. Local `/dev/` uses labeled sample data; Qollab uses its selected backend. Backend failures never silently substitute samples. Stop and Run again to restart.

Code: [MIT License](LICENSE). Media: [artwork credits](ART_CREDITS.md).

**This effort is supported by Qollab & IonQ**.