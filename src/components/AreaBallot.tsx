"use client";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { areaFromPath, areaHead, hasContest, viewFor, type AreaView, type ElectionSnapshot } from "@/lib/area-view";
import { carryQuery } from "@/lib/filters";
import { BallotView } from "./BallotView";
import { CARRIED, CHANGE_EVENT, currentSearch, pushPath, useLocationPath } from "./useBallotFilters";
import { markHomeVisit } from "./useHomeRedirect";

const loaded = new Map<string, ElectionSnapshot>();
const loading = new Map<string, Promise<ElectionSnapshot | null>>();

function loadSnapshot(url: string): Promise<ElectionSnapshot | null> {
  let p = loading.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<ElectionSnapshot>) : null))
      .catch(() => null)
      .then((s) => {
        if (s) loaded.set(url, s);
        else loading.delete(url);
        return s;
      });
    loading.set(url, p);
  }
  return p;
}

// Scroll by path, so Back and Forward between areas land where the visitor left each one.
const scrolls = new Map<string, number>();

type Props = { election: string } & ({ snapshot: ElectionSnapshot } | { initial: AreaView; snapshotUrl: string });

/** A list page that switches areas in the browser once it has every area's data. */
export function AreaBallot({ election, ...props }: Props) {
  const url = "snapshotUrl" in props ? props.snapshotUrl : null;
  const [fetched, setFetched] = useState(() => (url ? loaded.get(url) : undefined));
  const snap = "snapshot" in props ? props.snapshot : fetched;
  const initial = "initial" in props ? props.initial : viewFor(props.snapshot, null);

  const path = useLocationPath(initial.area ? `/${election}/${initial.area}` : `/${election}`);
  const fromPath = snap ? areaFromPath(snap, path) : undefined;
  const areaId = fromPath === undefined ? initial.area : fromPath;
  const deferredArea = useDeferredValue(areaId);
  const view = deferredArea === initial.area || !snap ? initial : viewFor(snap, deferredArea);
  const head = useMemo(() => (areaId === initial.area || !snap ? initial : areaHead(snap, areaId)), [areaId, initial, snap]);

  const load = useCallback(() => {
    if (url && !loaded.has(url)) void loadSnapshot(url).then((s) => s && setFetched(s));
  }, [url, setFetched]);
  useEffect(() => {
    if (!url || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    if (!("requestIdleCallback" in window)) {
      const t = setTimeout(load, 2000);
      return () => clearTimeout(t);
    }
    const id = requestIdleCallback(load, { timeout: 5000 });
    return () => cancelIdleCallback(id);
  }, [url, load]);

  const onSwitch = (href: string, { replace = false }: { replace?: boolean } = {}) => {
    if (!snap) {
      load();
      return false;
    }
    const target = areaFromPath(snap, href);
    if (target === undefined) return false;
    const q = new URLSearchParams(carryQuery(currentSearch(), CARRIED));
    const c = new URLSearchParams(currentSearch()).get("c");
    if (c && hasContest(snap, target, c)) q.set("c", c);
    markHomeVisit(target);
    const search = q.toString();
    return pushPath(search ? `${href}?${search}` : href, { replace });
  };
  const switchRef = useRef(onSwitch);
  useLayoutEffect(() => {
    switchRef.current = onSwitch;
  });
  const onSwitchStable = useCallback((href: string, opts?: { replace?: boolean }) => switchRef.current(href, opts), []);

  const restore = useRef(false);
  useEffect(() => {
    let y = window.scrollY;
    let here = window.location.pathname;
    const onScroll = () => {
      y = window.scrollY;
    };
    const onMove = (e: Event) => {
      if (window.location.pathname === here) return;
      scrolls.set(here, y);
      here = window.location.pathname;
      restore.current = e.type === "popstate";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onMove);
    window.addEventListener(CHANGE_EVENT, onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onMove);
      window.removeEventListener(CHANGE_EVENT, onMove);
    };
  }, []);
  // After the list for a Back or Forward has drawn; a chip click leaves scroll alone.
  useLayoutEffect(() => {
    if (!restore.current || deferredArea !== areaId) return;
    restore.current = false;
    const y = scrolls.get(window.location.pathname);
    if (y !== undefined) window.scrollTo(0, y);
  }, [deferredArea, areaId]);

  useEffect(() => {
    document.title = head.title;
  }, [head.title]);

  return (
    <BallotView
      election={election}
      area={view.area}
      links={head.links}
      intro={view.intro}
      groups={view.groups}
      guides={view.guides}
      allGuides={view.allGuides}
      files={view.files}
      pending={view.pending}
      fallback={view.fallback}
      busy={deferredArea !== areaId}
      onSwitch={onSwitchStable}
      onIntent={load}
    />
  );
}
