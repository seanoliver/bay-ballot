"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDownIcon } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { countLabel, type NavPlace } from "@/lib/section-nav";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-9 items-baseline justify-between gap-4 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-muted max-lg:min-h-11 max-lg:items-center";

export function SectionNav({
  places,
  current,
  open,
  stuck,
  onOpenChange,
  onJump,
}: {
  places: NavPlace[];
  current: string | null;
  open: boolean;
  stuck: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (id: string) => void;
}) {
  const jumped = useRef<string | null>(null);
  const all = places.flatMap((p) => p.sections);
  const here = all.find((s) => s.id === current) ?? all[0];
  if (!here) return null;
  const jump = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    jumped.current = id;
    onJump(id);
  };
  return (
    <div data-section-nav data-stuck={stuck ? "" : undefined} className="js-only sticky top-0 z-10 -mx-1 bg-muted px-1 py-1.5 data-stuck:shadow-[0_1px_0_var(--border)] dark:bg-background">
      <Menu.Root
        open={open}
        onOpenChange={onOpenChange}
        modal={false}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen) document.querySelector<HTMLElement>("[data-section-menu] [aria-current=location]")?.focus();
        }}
      >
        <Menu.Trigger
          aria-label={`Jump to a section. Now: ${here.place}, ${here.name}`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg pr-2.5 pl-1 text-sm outline-none hover:bg-foreground/5 focus-visible:outline-3 focus-visible:outline-ring data-popup-open:bg-foreground/5 max-lg:min-h-11 max-lg:w-full"
        >
          <span className="whitespace-nowrap text-muted-foreground">{here.place}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ›
          </span>
          <span className="truncate font-semibold">{here.name}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground max-lg:ml-auto" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={2} collisionPadding={16} className="z-50 outline-none">
            <Menu.Popup
              data-section-menu
              finalFocus={() => {
                const id = jumped.current;
                jumped.current = null;
                return id ? document.getElementById(id) : true;
              }}
              className="scrollbar-thin max-h-[min(28rem,var(--available-height))] w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-xl bg-popover p-1.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-[opacity,scale] duration-(--motion-in) ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-(--motion-out) data-starting-style:scale-[0.97] data-starting-style:opacity-0"
            >
              {places.map((p, i) => (
                <Menu.Group key={p.id}>
                  {i > 0 ? <Menu.Separator className="mx-1 my-1.5 h-px bg-border" /> : null}
                  <Menu.GroupLabel className="sr-only">{p.heading}</Menu.GroupLabel>
                  <Menu.LinkItem
                    href={`#${p.id}`}
                    label={p.heading}
                    aria-label={countLabel(p.heading, p.count)}
                    onClick={jump(p.id)}
                    closeOnClick
                    className={cn(ITEM, "font-semibold")}
                  >
                    {p.heading}
                    <span className="font-normal text-muted-foreground tabular-nums">{p.count}</span>
                  </Menu.LinkItem>
                  {p.sections.map((s) => (
                    <Menu.LinkItem
                      key={s.id}
                      href={`#${s.id}`}
                      label={`${p.heading} ${s.name}`}
                      aria-label={countLabel(s.name, s.count)}
                      aria-current={s.id === here.id ? "location" : undefined}
                      onClick={jump(s.id)}
                      closeOnClick
                      className={cn(ITEM, "pl-5 aria-[current=location]:font-semibold")}
                    >
                      {s.name}
                      <span className="font-normal text-muted-foreground tabular-nums">{s.count}</span>
                    </Menu.LinkItem>
                  ))}
                </Menu.Group>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
