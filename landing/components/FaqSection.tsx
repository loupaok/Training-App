"use client";

import { useState } from "react";
import type { getSiteContent } from "@/lib/keystatic/reader";

type FaqSection = Awaited<ReturnType<typeof getSiteContent>>["faqSection"];

export function FaqSection({ faqSection }: { faqSection: FaqSection }) {
  const [open, setOpen] = useState<number | null>(0);
  const items = faqSection?.items || [];
  if (!items.length) return null;

  return (
    <section id="faq" className="bg-[#f8f8f5] px-5 py-20 text-[#0b0b0b] sm:px-8 lg:px-20 lg:py-[120px]">
      <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-eyebrow uppercase text-[#6a6a6a] sm:text-eyebrow-d">{faqSection?.eyebrow || "FAQ"}</p>
          <h2 className="mt-5 text-h2b italic uppercase sm:text-h2b-d">{faqSection?.heading || "Συχνές ερωτήσεις."}</h2>
        </div>
        <div className="border-t border-[#d8d8d4]">
          {items.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={index} className="border-b border-[#d8d8d4]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-h3"
                >
                  <span>{faq.question}</span>
                  <span className="text-2xl font-normal">{isOpen ? "−" : "+"}</span>
                </button>
                <p className={`max-w-2xl pb-6 text-body leading-7 text-[#555] ${isOpen ? "block" : "hidden"}`}>{faq.answer}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
