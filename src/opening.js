import { createOpeningFlow } from './scenes.js';
import { createIntroVideo } from './cutscene.js';

export function mountOpening(root, { onStart, onEnter, onReady }) {
  const find = id => root.querySelector(id);
  const curtain = find('#opening');
  const video = find('#intro-film');
  const controls = find('#film-controls');
  let media;
  const fade = (element, from, to, duration) => element.animate(
    [{ opacity: from }, { opacity: to }],
    { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration, fill: 'forwards' },
  ).finished.catch(() => {});
  const blocked = error => {
    if (flow.phase() !== 'film') return;
    // Pausing while play() is still buffering rejects that promise normally.
    // Keep the ordinary Resume control, rather than claiming the film failed.
    if (error?.name === 'AbortError' && video.paused) return;
    find('#film-error').hidden = false;
    find('#film-error').textContent = error?.name === 'NotAllowedError'
      ? 'Press Resume to play the film.' : 'The film could not play. You can continue to the case.';
    find('#resume-film').hidden = false;
    find('#resume-film').focus();
  };
  const playFilm = async () => {
    find('#film-error').hidden = true;
    if (!media) { media = createIntroVideo(); video.src = media.url; }
    video.hidden = false;
    await video.play();
    find('#resume-film').hidden = true;
  };
  const flow = createOpeningFlow({
    onStart,
    async fadePlay() {
      find('#play').disabled = true;
      await fade(find('#play'), 1, 0, 550);
      find('#play').hidden = true;
      if (flow.phase() !== 'fading') return;
      controls.hidden = false;
      find('#skip-film').focus();
    },
    playFilm,
    stopFilm() { video.pause(); controls.hidden = true; find('#film-error').hidden = true; },
    fadeFilm: () => fade(video, 1, 0, 450),
    enterDesk: onEnter,
    async revealDesk() {
      await fade(curtain, 1, 0, 850);
      curtain.hidden = true;
      video.removeAttribute('src');
      video.load();
      media?.dispose();
      onReady();
    },
    blocked,
  });
  find('#play').addEventListener('click', () => flow.start());
  find('#skip-film').addEventListener('click', () => flow.enter());
  find('#resume-film').addEventListener('click', () => playFilm().catch(blocked));
  find('#pause-film').addEventListener('click', () => video.paused ? playFilm().catch(blocked) : video.pause());
  find('#mute-film').addEventListener('click', () => {
    video.muted = !video.muted;
    find('#mute-film').textContent = video.muted ? 'Unmute' : 'Mute';
    find('#mute-film').setAttribute('aria-pressed', String(video.muted));
  });
  video.addEventListener('play', () => { find('#pause-film').textContent = 'Pause'; });
  video.addEventListener('pause', () => { find('#pause-film').textContent = 'Resume'; });
  video.addEventListener('ended', () => flow.enter());
  video.addEventListener('error', () => blocked(new Error('Unsupported or unavailable video')));
  curtain.addEventListener('keydown', event => {
    if (event.key === 'Escape' && flow.phase() !== 'idle') { event.preventDefault(); flow.enter(); }
  });
  return flow;
}
