# Artwork and presentation

Sourced in `sprites/`:

- `device 1 transparent.png`: Device A, amber screen.
- `device 2 transparent.png`: Device B, green screen.
- `dial_up_phone transparent.png`: rotary phone used to call Trace.
- `notebook transparent.png`: evidence notebook.
- `workbench.jpg`: tabletop background.

Original files are preserved. The `art/*.js` runtime copies contain embedded
WebP data URLs. The four sprites have only their transparent outer padding
trimmed and are encoded losslessly. The background is re-encoded at WebP
quality 90 without resizing. `dev/package_sprites.py` reproduces these copies.

The report paper, controls, frames and textures are CSS. Text uses the local
Georiga / Times New Roman / serif font stack. No font files or CDN are required.

All sprites/images are drafted using Gemini Nano Bananna 2.1 and then human-enhanced.

This effort is supported by Qollab & IonQ.