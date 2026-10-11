// Presentation flow only. It cannot see case truth or submit a quantum job.
// Injected effects make skip/end races and blocked playback deterministic tests.
export function createOpeningFlow({ onStart, fadePlay, playFilm, stopFilm, fadeFilm, enterDesk, revealDesk, blocked }) {
  let phase = 'idle';
  let starting;
  let entering;
  return {
    phase: () => phase,
    start() {
      if (starting) return starting;
      phase = 'fading';
      starting = (async () => {
        onStart();
        await fadePlay();
        if (phase !== 'fading') return;
        phase = 'film';
        try { await playFilm(); }
        catch (error) { if (phase === 'film') blocked(error); }
      })();
      return starting;
    },
    enter() {
      if (phase === 'idle') return Promise.resolve();
      if (entering) return entering;
      phase = 'entering';
      entering = (async () => {
        stopFilm();
        await fadeFilm();
        enterDesk();
        await revealDesk();
        phase = 'done';
      })();
      return entering;
    },
  };
}
