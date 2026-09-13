"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [20, 30, 40, 50];

interface PaginationControlsProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  variant?: "full" | "summary" | "pages";
}

export default function PaginationControls({
  totalItems,
  pageSize,
  currentPage,
  onPageSizeChange,
  onPageChange,
  itemLabel = "αποτελέσματα",
  variant = "full",
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const showSummary = variant === "full" || variant === "summary";
  const showPages = (variant === "full" || variant === "pages") && totalPages > 1;

  return (
    <div className="flex min-h-[84px] items-center justify-between gap-5 px-6 py-4">
      {showSummary ? (
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{totalItems === 0 ? `Δεν υπάρχουν ${itemLabel}` : `Εμφανίζονται ${start} έως ${end} από ${totalItems} ${itemLabel}`}</span>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            Ανά σελίδα
            <Select value={String(pageSize)} onValueChange={(value) => value && onPageSizeChange(Number(value))}>
              <SelectTrigger className="h-10 w-20 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      ) : (
        <div />
      )}

      {showPages && (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                aria-disabled={safePage === 1}
                className={safePage === 1 ? "pointer-events-none opacity-40" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(Math.max(1, safePage - 1));
                }}
              />
            </PaginationItem>
            {getPageItems(totalPages, safePage).map((item, index) =>
              item === "..." ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                text=""
                aria-disabled={safePage === totalPages}
                className={safePage === totalPages ? "pointer-events-none opacity-40" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(Math.min(totalPages, safePage + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function getPageItems(totalPages: number, currentPage: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}
