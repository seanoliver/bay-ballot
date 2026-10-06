"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [string[], string][] = [
  [["↓", "j"], "Next contest"],
  [["↑", "k"], "Previous contest"],
  [["Esc"], "Close the details"],
  [["/"], "Search guides"],
  [["?"], "Show these shortcuts"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
      </DialogContent>
    </Dialog>
  );
}
