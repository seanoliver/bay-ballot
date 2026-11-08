"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

export type LinkOption = { value: string; label: string; snippet: string };

export function LinkMaker({ options }: { options: LinkOption[] }) {
  const [value, setValue] = useState(options[0].value);
  const snippet = (options.find((o) => o.value === value) ?? options[0]).snippet;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="link-target" className="text-sm font-medium">
          Link to
        </label>
        <select
          id="link-target"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words">
        <code id="link-snippet">{snippet}</code>
      </pre>
      <CopyButton key={snippet} text={snippet} selectId="link-snippet" failLabel="Select the code above to copy" />
    </div>
  );
}
