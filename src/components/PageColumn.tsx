import type { ReactNode } from "react";
import { COLUMN, FRAME } from "./frame";

export function PageColumn({ children }: { children: ReactNode }) {
  return (
    <div className={FRAME}>
      <div data-page-column className={COLUMN}>
        {children}
      </div>
    </div>
  );
}
