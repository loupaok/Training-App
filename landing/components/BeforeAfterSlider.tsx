"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  name,
}: {
  beforeImage?: string | null;
  afterImage?: string | null;
  name?: string | null;
}) {
  const [percent, setPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, pct)));
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-2xl"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) updateFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {afterImage && <Image src={afterImage} alt={`${name || ""} — μετά`} fill className="pointer-events-none object-cover" sizes="400px" />}
      {beforeImage && (
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
          <Image src={beforeImage} alt={`${name || ""} — πριν`} fill className="object-cover" sizes="400px" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-lime" style={{ left: `${percent}%` }} />
      <div
        className="pointer-events-none absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-lime text-navy-900 shadow-lg"
        style={{ left: `${percent}%` }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
          <path d="M8 7 4 12l4 5M16 7l4 5-4 5" />
        </svg>
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">ΠΡΙΝ</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-lime px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-900">ΜΕΤΑ</span>
    </div>
  );
}
