"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "./icons";

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.replace("/embed/", "");
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.replace("/shorts/", "");
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  } catch {
    return null;
  }
}

export function VideoPopupButton({ videoUrl, className, children }: { videoUrl?: string | null; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const embedUrl = videoUrl ? getYoutubeEmbedUrl(videoUrl) : null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!embedUrl) {
    return (
      <button type="button" className={className}>
        {children}
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label="Κλείσιμο"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={embedUrl}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
