export function createQollabAdapter(experiments, selectedBackend) {
  let pending;
  return {
    label: 'Qollab — selected backend',
    load() {
      // Cache success AND failure: never accidentally spend a second IonQ job.
      if (!pending) pending = (async () => {
        let returned;
        try {
          returned = await experiments.run_case_json.callPromising(selectedBackend, 512);
          const plain = typeof returned === 'string' ? returned : returned.toJs();
          return JSON.parse(plain);
        } finally {
          returned?.destroy?.();
        }
      })();
      return pending;
    },
  };
}
