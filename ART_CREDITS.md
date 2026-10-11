# Artwork and presentation

Original files are preserved in `artwork/sprites/` and `artwork/cutscenes/`. The `assets/art/*.js` runtime copies contain embedded
WebP data URLs. The four sprites have only their transparent outer padding
trimmed and are encoded losslessly. The background is re-encoded at WebP
quality 90 without resizing. `scripts/package_sprites.py` reproduces these copies.

The supplied magnifying glass is trimmed and resized to 552 × 512 pixels with
nearest-neighbor sampling, then encoded as lossless WebP for the desk tool.

The panel paper, controls, frames and textures are CSS. Text uses the local
Georgia / Times New Roman / serif font stack. No font files or CDN are required.

All sprites, images, and animations are drafted using Gemini Nano Bananna 2.1 and Gemini Veo 3.1 and then human-enhanced.

This effort is supported by Qollab & IonQ.
