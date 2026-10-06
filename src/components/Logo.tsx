import { HOLE, HOLE_RADIUS, HOLES, LOGO_VIEWBOX, OFF_OPACITY } from "@/lib/logo";

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      shapeRendering={size < 24 ? "crispEdges" : undefined}
      className={className}
    >
      {HOLES.map((h) => (
        <rect key={`${h.x}-${h.y}`} x={h.x} y={h.y} width={HOLE} height={HOLE} rx={HOLE_RADIUS} opacity={h.on ? undefined : OFF_OPACITY} />
      ))}
    </svg>
  );
}
