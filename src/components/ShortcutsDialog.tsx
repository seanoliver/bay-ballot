"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";

const SHORTCUTS: [string[], string][] = [
  [["↓", "j"], "Next contest"],
  [["↑", "k"], "Previous contest"],
  [["Esc"], "Close the details"],
  [["g"], "Jump to a section"],
  [["/"], "Search guides"],
  [["?"], "Show these shortcuts"],
];

const isSingle = (k: string) => k.length === 1 && /[a-z/?]/.test(k);

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([keys, action]) => {
            const off = !singleKeys && keys.every(isSingle);
            return (
              <div key={action} className={cn("flex items-center justify-between gap-4", off && "text-muted-foreground")}>
                <dt className="flex gap-1">
                  {keys.map((k) => {
                    const keyOff = !singleKeys && isSingle(k);
                    return (
                      <kbd
                        key={k}
                        className={cn(
                          "min-w-6 rounded border border-border bg-muted px-1.5 text-center font-sans text-xs leading-6",
                          keyOff && "line-through opacity-60",
                        )}
                      >
                        {k}
                        {keyOff && !off ? <span className="sr-only"> (off)</span> : null}
                      </kbd>
                    );
                  })}
                </dt>
                <dd>{off ? `${action} (off)` : action}</dd>
              </div>
            );
          })}
        </dl>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-border pt-3 text-sm">
          <span>Single-key shortcuts (j, k, g, /, and ?)</span>
          <Switch checked={singleKeys} onCheckedChange={onSingleKeysChange} />
        </label>
      </DialogContent>
    </Dialog>
  );
}
