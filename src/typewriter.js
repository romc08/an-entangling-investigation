// One cancellable line at a time. Injectable clock keeps lifecycle tests fast.
export function createTypewriter({ write, complete = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
  let timer, letters = [], index = 0, generation = 0;
  const stop = () => { generation++; cancel(timer); timer = undefined; };
  const finish = () => { stop(); index = letters.length; write(letters.join('')); complete(); };
  return {
    stop,
    start(text, immediate = false) {
      stop(); letters = Array.from(text); index = 0; write('');
      if (immediate || !letters.length) { finish(); return; }
      const current = generation;
      function tick() {
        if (current !== generation) return;
        write(letters.slice(0, ++index).join(''));
        if (index === letters.length) { timer = undefined; complete(); }
        else timer = schedule(tick, 18);
      }
      timer = schedule(tick, 18);
    },
  };
}
