"use client";

import { useState } from "react";

const items = [
  ["Χρειάζομαι γυμναστήριο;", "Όχι. Το πλάνο φτιάχνεται με βάση τον εξοπλισμό που έχεις — γυμναστήριο, σπίτι ή συνδυασμό."],
  ["Πόσο γρήγορα παίρνω το πλάνο μου;", "Μέσα σε [Χ] ημέρες από τη συμπλήρωση του ερωτηματολογίου."],
  ["Πώς λειτουργούν οι πόντοι;", "Κάθε πληρωμή σου δίνει πόντους, τους οποίους εξαργυρώνεις σε έκπτωση, 1:1 βιντεοκλήσεις ή SP Team merch."],
  ["Δεν έχω χρησιμοποιήσει ποτέ Discord.", "Κανένα πρόβλημα. Είναι ο τρόπος που μιλάμε με μηνύματα, φωνητικά και video. Χρειάζεσαι μόνο έναν δωρεάν λογαριασμό."],
  ["Μπορώ να ακυρώσω;", "Ναι, όποτε θες, χωρίς δέσμευση."],
  ["Είναι για αρχάριους;", "Απόλυτα. Κάθε πλάνο ξεκινά από το επίπεδό σου, με βίντεο εκτέλεσης για κάθε άσκηση."],
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return <section id="faq" className="bg-[#f8f8f5] px-5 py-20 text-[#0b0b0b] sm:px-8 lg:px-20 lg:py-[120px]"><div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#6a6a6a]">FAQ</p><h2 className="mt-5 text-5xl font-black italic uppercase leading-[.86] tracking-tight sm:text-7xl">Συχνές<br />ερωτήσεις.</h2></div><div className="border-t border-[#d8d8d4]">{items.map(([question, answer], index) => <div key={question} className="border-b border-[#d8d8d4]"><button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-6 py-6 text-left text-base font-bold sm:text-lg"><span>{question}</span><span className="text-2xl font-normal">{open === index ? "−" : "+"}</span></button>{open === index && <p className="max-w-2xl pb-6 text-sm leading-7 text-[#555]">{answer}</p>}</div>)}</div></div></section>;
}
