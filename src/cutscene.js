import { parts } from '../assets/media/intro.js';

// A Blob avoids relative media requests in Qollab. Each imported part is below
// the file-size limit; the original MP4 bytes are reconstructed without edits.
export function createIntroVideo() {
  const bytes = parts.map(part => Uint8Array.from(atob(part), char => char.charCodeAt(0)));
  const url = URL.createObjectURL(new Blob(bytes, { type: 'video/mp4' }));
  return { url, dispose: () => URL.revokeObjectURL(url) };
}
