"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type State = "idle" | "copied" | "failed";

export function CopyButton({ text, selectId, failLabel, className }: { text: string; selectId: string; failLabel: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      const el = document.getElementById(selectId);
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        state === "failed" ? "text-muted-foreground ring-1 ring-foreground/15" : "bg-foreground text-background hover:bg-foreground/85",
        className,
      )}
    >
      <span aria-live="polite">{state === "copied" ? "✓ Copied" : state === "failed" ? failLabel : "Copy"}</span>
    </button>
  );
}
