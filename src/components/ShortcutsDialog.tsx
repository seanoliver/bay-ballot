"use client";

import { useId } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const SHORTCUTS: [string[], string][] = [
  [["↓", "j"], "Next contest"],
  [["↑", "k"], "Previous contest"],
  [["Esc"], "Close the details"],
  [["/"], "Search guides"],
  [["?"], "Show these shortcuts"],
];

export function ShortcutsDialog({
  open,
  onOpenChange,
  singleKeys,
  onSingleKeysChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  singleKeys: boolean;
  onSingleKeysChange: (on: boolean) => void;
}) {
  const label = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="flex gap-1">
                {keys.map((k) => (
                  <kbd key={k} className="min-w-6 rounded border border-border bg-muted px-1.5 text-center font-sans text-xs leading-6">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3 text-sm">
          <span id={label}>Single-key shortcuts (j, k, /, and ?)</span>
          <Switch aria-labelledby={label} checked={singleKeys} onCheckedChange={onSingleKeysChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
