export type HistoryBudget = { run: (write: () => void) => void; note: () => void };

export function historyBudget({ max, windowMs }: { max: number; windowMs: number }): HistoryBudget {
  const stamps: number[] = [];
  let pending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prune = (now: number) => {
    while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
  };
  const drain = () => {
    timer = undefined;
    const now = Date.now();
    prune(now);
    if (pending && stamps.length < max) {
      const write = pending;
      pending = null;
      stamps.push(now);
      write();
    }
    if (pending) timer = setTimeout(drain, stamps[0] + windowMs - now);
  };
  return {
    run(write) {
      const now = Date.now();
      prune(now);
      if (stamps.length < max) {
        pending = null;
        clearTimeout(timer);
        timer = undefined;
        stamps.push(now);
        write();
        return;
      }
      pending = write;
      timer ??= setTimeout(drain, stamps[0] + windowMs - now);
    },
    note() {
      stamps.push(Date.now());
    },
  };
}
