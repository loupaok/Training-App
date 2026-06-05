const PAGE_SIZE_OPTIONS = [20, 30, 40, 50];

export default function PaginationControls({ totalItems, pageSize, currentPage, onPageSizeChange, onPageChange, itemLabel = 'αποτελέσματα', variant = 'full' }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const showSummary = variant === 'full' || variant === 'summary';
  const showPages = (variant === 'full' || variant === 'pages') && totalPages > 1;

  return (
    <div className="flex min-h-[84px] items-center justify-between gap-5 px-6 py-4">
      {showSummary ? (
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{totalItems === 0 ? `Δεν υπάρχουν ${itemLabel}` : `Εμφανίζονται ${start} έως ${end} από ${totalItems} ${itemLabel}`}</span>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            Ανά σελίδα
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 font-bold outline-none focus:border-red-300"
            >
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      ) : <div />}

      {showPages && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="h-11 min-w-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            «
          </button>
          {getPageItems(totalPages, safePage).map((item, index) => (
            item === '...' ? (
              <span key={`${item}-${index}`} className="grid h-11 min-w-11 place-items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500">...</span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={`h-11 min-w-11 rounded-md border px-4 text-sm font-bold ${item === safePage ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-900 hover:border-red-200 hover:text-red-600'}`}
              >
                {item}
              </button>
            )
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="h-11 min-w-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}

function getPageItems(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}
