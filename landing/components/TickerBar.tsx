"use client";

import { motion } from "framer-motion";

type Props = { items: readonly string[] };

export function TickerBar({ items }: Props) {
  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-9 overflow-hidden border-b border-lime/20 bg-navy-950 text-white">
      <motion.div
        className="flex h-9 w-max items-center gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 16, ease: "linear", repeat: Infinity }}
      >
        {loop.map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-label tracking-wide">
            {item}
            <span className="h-2 w-5 -skew-x-12 bg-lime" aria-hidden />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
