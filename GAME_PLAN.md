# Pixel-art game implementation plan

Planning date: October 9, 2026. Planning window: the user's stated 48 remaining hours.
This document proposes the next implementation; it does not claim these features already exist.

## Product decision

Build a 5–8 minute, single-case, point-and-click detective game. The museum introduces the fiction; the top-down workbench is the persistent play space. The objective is to restore the two missing exhibit labels using evidence. Every visible screen should share a pixel-art visual language, including menus, dialogue, instrument readouts and notebook pages.

This is feasible with the existing baseline and continued implementation assistance. It is a high-risk two-day project if a first-time developer must independently learn animation, create all original art and debug the platform. Estimates below are planning estimates, not guarantees.

The critical path is Qollab execution → complete tabletop investigation → supported conclusion. Art and cinematic polish should never block that path.

## Intended experience

1. Title screen with Play, brief controls and attribution.
2. Play opens a pixel-art museum establishing scene. An approximately 20-second, skippable Trace sequence explains the missing labels and objective.
3. A short stepped camera zoom moves toward a highlighted workbench. A fade conceals the change to a separately drawn overhead tabletop.
4. The player stays at this workbench for the investigation. Devices, setting controls, detector, notebook, Trace terminal and report folder are interactive objects in the scene.
5. A supported report restores the exhibit labels and triggers a short closing response. An insufficient-evidence report remains a valid ending, with a return-to-investigation option.

The transition uses two 2D illustrations. It does not require rotating a camera through a 3D room. Free movement, collision detection, inventory crafting, multiple rooms and extra cases are outside the deadline scope.

## The main gameplay loop

SELECT DEVICE → SET INSTRUMENT → PREDICT → UNCOVER MEASUREMENTS → COMPARE → RECORD A CLAIM

### Instrument interaction

- Click Device A or B to open its analyzer. The supplied amber and green sprites distinguish the fixed device labels only; their appearance is independent of randomized preparation truth and cannot serve as evidence.
- Turn a linked pair of measurement dials between two marked detents: original view (Z/Z) and rotated view (X/X). Labels explain both Left and Right settings. The apparatus supports these two presets for this milestone; free-angle dials would imply uncollected experiments.
- Choose a prediction using three illustrated tokens: mostly matching, roughly half matching, or unsure. Selecting a token and a slot by clicking is sufficient; drag-and-drop is optional.
- Pull a large lever to uncover the selected result. Give the device a brief light/scan animation and show the detector's outcome bins filling.
- The animation displays the actual stored histogram. It must not generate new random outcomes or imply that the player changes quantum probabilities through timing or dexterity. If a small illustrative sequence is used, label it as an illustration, not recorded shot order.
- A result ticket becomes available to pin in the notebook. The underlying record retains settings, actual shots, counts, uncertainty, provenance and the original prediction.

Keep each reveal short (roughly 1–2 seconds) and skippable. Replay replays the presentation of the same evidence; it never sends a new backend job or adds a duplicate record.

### Make inference the puzzle

The player's meaningful choices are what to inspect next, what to predict, and which evidence supports a claim. Cosmetic clicking alone is not the intended game loop.

Replace mandatory explanation text boxes with a small authored set of claim tiles, for example:

- "The outputs mostly match in this view."
- "Matching occurs in about half of the shots."
- "Both preparations could explain this Z/Z result."
- "Changing the view changed the pattern."
- "This evidence is ambiguous."

Let the player choose a claim and connect it to a result ticket. Compare the claim with the discovered statistics and context. If it is unsupported, Trace asks a targeted question; the player can revise it. Acknowledge uncertainty instead of forcing an ideal outcome when measurements are noisy. Prediction errors are learning opportunities, not lost lives.

Open two tickets side by side in the notebook for comparison. After a useful comparison, the player's task text progresses from finding a shared pattern to testing the alternative explanation. Evidence remains freely accessible; this guidance does not secretly reveal the source assignment or artificially lock a valid investigation order.

For the final report, select a device label (or insufficient evidence), cite interpreted tickets, and assemble a short reasoning chain from claim tiles. Free text becomes optional. A named-device conclusion still requires the two X/X records; an insufficient-evidence conclusion cites at least one interpreted record. This change requires explicit updates to the current text-length gates in game.js/evidence.js and their tests, not hidden placeholder sentences submitted on the player's behalf.

Avoid accuracy scores, countdown pressure, reflex challenges and arbitrary resource penalties. Completion is tied to a defensible chain of evidence. Hint use should not punish a beginner.

## Workbench layout

| Object | Role |
| --- | --- |
| Two exhibit devices, left side | Select the subject of the next experiment |
| Linked dials and lever, center | Choose the preset, place prediction and uncover |
| Detector/readout, upper right | Show counts and matching pattern |
| Notebook, lower left | Collect, interpret and compare evidence tickets |
| Small Trace terminal, upper corner | Dialogue and the three existing hint actions |
| Report folder, lower right | Assemble the conclusion and supporting evidence |

Use visible hover/focus outlines, short object labels and clear pressed states. Support clicking and keyboard selection; do not make dragging the only interaction. Escape closes an overlay, and closing it restores focus to its workbench object. Keep long statistics and circuit explanations in an optional notebook detail view. Plan for laptop play first, with scaled or rearranged controls when the frame is small.

## Technical approach

Stay with plain HTML, CSS and JavaScript. Use a layered 2D stage: low-resolution background/sprite images and positioned HTML controls, styled as physical objects. CSS transforms and a small JavaScript scene controller provide the zoom, fades and sprite-frame changes. Canvas is optional for the detector effects; a game engine is not needed for this scope.

Use a provisional 480 × 270 art coordinate system and a small fixed palette. Prefer integer scaling when space permits, nearest-neighbor image rendering and pixel-aligned placement. Use a readable, licensed pixel font; keep dialogue short. The whole interface should match the art, but text and click targets must remain comfortably readable.

Keep the existing production/development adapter boundary. Preserve the tested preparations and statistics. Refactor presentation incrementally around these responsibilities:

- `scenes.js`: title, museum, transition, workbench, ending and cutscene timing.
- `ui.js`: shared stage shell, overlays, focus and keyboard behavior.
- `workbench.js`: instrument selection, prediction tokens and reveal presentation.
- `assets.js`: a small sprite atlas, asset lookup and embedded image data.
- `game.js`: private truth, result bank and progress; add explicit reveal/interpretation states as needed.
- `evidence.js`: evidence validation and authored claim/report rules.
- `assistant.js`: discovered evidence, selected object and progress only.

Add modules only as their responsibilities become useful. Do not introduce a general-purpose engine or asset build pipeline.

The logical flow should distinguish prediction, presentation in progress, result visible and interpretation saved. This prevents double pulls, changing settings midway through a reveal and opening results before a prediction. Cutscene skipping must cancel pending timers and finish the transition exactly once.

## Qollab integration constraints

- Pressing Qollab Run chooses the backend; Play starts the game inside that run.
- Start the existing single 24-circuit collection when Play is pressed, alongside the introduction. Show a truthful lab status if the job outlasts the intro. The cutscene is not a fake progress timer, and skipping it must not create another job.
- The player can inspect instructions and apparatus while the job is pending. Evidence cannot be revealed until it is ready.
- State plainly in the fiction/UI: "The lab collects the measurements together. You choose which records to investigate." The lever reveals an already collected result; it is not a fresh IonQ submission.
- Keep backend errors explicit, preserve the selected-backend/sample-data label, and require Stop → Run for a new Qollab job. No automatic fallback to sample data.
- Do not depend on localStorage, external POST requests or relative JavaScript fetch for project assets.
- Proposed asset route: embed one small PNG atlas as a data URL exported from `assets.js`; retain its source image for editing and credits. This uses supported JS module imports and avoids an unverified relative-image URL assumption. Test image and font decoding in Qollab at the start. If unavailable, render simple palette-based pixel shapes directly with code while resolving loading.
- Keep all files below 2 MB, including base64 overhead, and the project below 100 uploaded files. Keep external network assets out of the critical path.
- Browser presentation and local simulation can run client-side. A chosen IonQ remote simulator or QPU executes the quantum job remotely. "Web game" does not mean remote quantum computation is offline.

Actual Qollab execution remains unverified in this repository. The platform smoke test must precede substantial visual work. Runtime compatibility does not by itself verify the event's judging/submission rules; check the organizer's current rules, including external assets and AI assistance, rather than assume permission from a similarly named event.

## Art budget

You do not need to draw all sprites yourself. Use one cohesive existing pixel-art pack for walls, floors and props, then create or adapt the few distinctive objects. Kenney's official Tiny Dungeon and Tiny Town packs are possible CC0 starting points, not complete museum asset sets. Check their visual fit before committing; keep a simple asset-credit manifest even for assets that do not require attribution.

Minimum inventory:

- One museum establishing background, assembled from reusable tiles/props.
- One overhead tabletop background.
- One device design reused for A and B, with 2–3 light states.
- One Trace terminal or portrait, with 2–3 blink/talking frames.
- One lever with two positions and two dial settings.
- Notebook, report folder and a small shared set of prediction/outcome icons.
- One consistent panel/border style and a readable pixel font.

Budget approximately 10–15 distinct asset types plus a few frames. A single atlas can hold most objects. Do not create a walking detective for the first version; the point of view already establishes the player's presence.

AI-generated art is an optional source for concept/background drafts if the event permits it. Small animated sprites need consistent dimensions, palette and silhouettes, so generated sheets can take longer to clean up than simple hand-authored or reused assets. We can create the small custom objects in code or edit sprites together; there is no expectation that the user becomes a pixel artist during this deadline.

## Intro cutscene

Recommended format: a roughly 20-second in-engine animated scene with text dialogue, two backgrounds and a few looping frames. No video export or prerecorded speech is needed.

| Approximate time | Scene beat | Trace dialogue |
| --- | --- | --- |
| 0–5 s | Museum lights appear; Trace terminal blinks | "Detective. The exhibit opens tomorrow, and two preparation records are missing." |
| 5–11 s | Highlight the two devices | "One device creates an entangled pair. The other creates an ordinary correlated mixture." |
| 11–17 s | Slow, stepped push toward the bench | "Matching answers won't settle it. Change the setting. Find out which pattern survives." |
| 17–22 s | Fade to overhead desk; highlight notebook | "Test your predictions. Keep the evidence. Then restore the labels." |

Give each line enough reading time; allow click/Space to advance and a visible Skip from the beginning. An option to pause/continue dialogue and reduced-motion behavior prevents the timing from becoming a barrier. Skipping always lands at the same valid workbench state. Avoid simulated speech typing that forces the user to wait.

Once art and scene handling exist, budget about 1–2 focused hours for this limited sequence with implementation assistance. A fully hand-animated 15–30 second character scene, true perspective rotation or lip-synced voice sequence is a much larger, unpredictable task and should be deferred.

## Work budget and checkpoints

These are approximate focused-work budgets with assistance, not a requirement to work 48 consecutive hours.

| Stage | Budget | Completion test |
| --- | --- | --- |
| Preserve baseline; Qollab execution and asset smoke test | 2–3 h | Selected backend produces one valid batch; one pixel asset displays |
| Build the tabletop scene with placeholder objects | 3–4 h | Device, dials, notebook, Trace and report work by click/keyboard |
| Implement the investigation loop and claim-based report | 6–8 h | Complete the case without typing; actual evidence drives all feedback |
| Apply a cohesive pixel-art asset set | 3–4 h | Every visible game screen shares the style and remains readable |
| Add the short intro/zoom sequence | 1–2 h | Normal, skipped and reduced-motion paths all reach a usable bench |
| Playtest and verify on Qollab | 3–4 h | Full run on built-in and IonQ remote simulators; noisy/failure paths exercised |
| Prepare demo, credits and submission | 1–2 h | Reproducible launch instructions and a short recorded play-through |

Total planned focused work: approximately 19–27 hours. Protect another 5–7 hours for integration surprises and the remainder for sleep, breaks and submission margin. A major Qollab blocker can exceed this buffer; escalate it to the organizer early.

Checkpoints:

- Early: validate the actual platform instead of accumulating untested art/framework dependencies.
- Around hour 16–20: the entire case must be playable with placeholders. If it is not, reduce animation and interaction complexity immediately.
- At least six hours before submission: freeze features. Reserve remaining work for fixes, actual platform testing and the demo.

Cut order if time is tight: ambient sound → extra sprite animation → elaborate camera motion → auto-timed cutscene (retain short skippable dialogue). Keep the workbench loop, evidence-based conclusion, accessible controls, honest provenance and error states. Keep CHSH UI deferred; its circuits and analysis already remain in the batch.

## Acceptance checklist

Current implementation: direct Play → full-window sprite workbench; user-supplied devices, rotary phone, notebook and background; matching metal/paper panels with local typewriter fonts. Device sprites open analyzers; notebook/phone/report open their respective panels. Embedded WebP modules avoid relative image fetches. Source artwork is preserved. Cutscene and museum transition remain deferred. Actual Qollab image decoding and runtime checks remain pending.

- [x] Existing baseline preserved in Git before replacing the presentation (`728ddf9`).
- [ ] Play → museum → overhead workbench works; intro is skippable.
- [x] Sprite scene and retro controls/panels share the supplied artwork's palette; readable local typewriter fonts are used.
- [x] Main play happens through workbench objects, with notebook/Trace/report overlays.
- [x] Both devices and both measurement presets support a prediction before reveal.
- [x] Results and animation agree with the result bank; repeat clicks/replay never send another job.
- [x] Evidence can be interpreted, compared and cited without mandatory typing.
- [ ] Prediction mistakes and noisy evidence receive helpful, scientifically bounded feedback.
- [x] Supported identification and insufficient-evidence reports both work (ending presentation remains provisional).
- [x] Hidden assignment remains unavailable to Trace and cosmetic rendering.
- [ ] Keyboard, skip, reduced-motion, loading and error paths are checked.
- [ ] Actual Qollab built-in and IonQ remote-simulator runs are documented honestly.
- [x] Existing quantum/statistical tests still pass; meaningful new interaction/state tests pass (13 Python, 12 JavaScript).
- [x] MIT code license and Qollab/IonQ attribution remain available; supplied sprite provenance is recorded in ART_CREDITS.md.

## References

- Qollab runtime: https://qollab.xyz/learn/docs/runtime-environment
- Qollab JS/Qiskit projects: https://qollab.xyz/learn/docs/js-qiskit-projects
- Qollab compute backends: https://qollab.xyz/learn/docs/compute-backends
- MDN pixel-art rendering: https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look
- Kenney Tiny Dungeon: https://kenney.nl/assets/tiny-dungeon
- Kenney Tiny Town: https://kenney.nl/assets/tiny-town

The Qollab references were read during the first milestone; the web reader remained unable to retrieve them during this planning pass. This plan also follows the supplied project constraints. Asset listings and browser pixel-rendering guidance were checked for this plan. Exact rules for this specific hackathon have not been independently verified.
