type Props = { items: readonly string[] };

export function TickerBar({ items }: Props) {
  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-9 overflow-hidden border-b border-lime/20 bg-navy-950 text-white">
      <div className="animate-[ticker_28s_linear_infinite] flex h-9 w-max items-center gap-10 whitespace-nowrap">
        {loop.map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-[11px] font-bold tracking-wide">
            {item}
            <span className="h-2 w-5 -skew-x-12 bg-lime" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
