export type HistoryBudget = {
  run: (write: () => void, cost?: number) => void;
  note: (cost?: number) => void;
  tryNote: (cost: number) => boolean;
};

export function historyBudget({ max, windowMs }: { max: number; windowMs: number }): HistoryBudget {
  const stamps: number[] = [];
  let pending: { write: () => void; cost: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prune = (now: number) => {
    while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
  };
  const take = (now: number, cost: number) => {
    for (let i = 0; i < cost; i++) stamps.push(now);
  };
  const fits = (now: number, cost: number) => {
    prune(now);
    return stamps.length + cost <= max;
  };
  const wait = (now: number, cost: number) => {
    const freeAt = stamps[Math.min(stamps.length - 1, stamps.length + cost - max - 1)] + windowMs;
    timer = setTimeout(drain, Math.max(0, freeAt - now));
  };
  const drain = () => {
    timer = undefined;
    const now = Date.now();
    if (!pending) return;
    if (fits(now, pending.cost)) {
      const p = pending;
      pending = null;
      take(now, p.cost);
      p.write();
    } else wait(now, pending.cost);
  };
  return {
    run(write, cost = 1) {
      const now = Date.now();
      if (fits(now, cost)) {
        pending = null;
        clearTimeout(timer);
        timer = undefined;
        take(now, cost);
        write();
        return;
      }
      pending = { write, cost };
      if (timer === undefined) wait(now, cost);
    },
    note(cost = 1) {
      take(Date.now(), cost);
    },
    tryNote(cost) {
      const now = Date.now();
      if (!fits(now, cost)) return false;
      take(now, cost);
      return true;
    },
  };
}
