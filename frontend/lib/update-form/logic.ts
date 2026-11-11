import type { Answers, FormDefinition, Question, ScoreTier, Step } from "./types";

export function isVisible(q: Question, a: Answers): boolean {
  const c = q.showIf;
  if (!c) return true;
  if (!c.questionId) return false;
  const v = a[c.questionId];
  if (v === undefined || v === null || v === "") return false;
  if (c.op === "is") return v === c.value;
  if (c.op === "includes") return Array.isArray((v as { chips?: unknown[] })?.chips ?? v) && ((v as { chips?: unknown[] })?.chips ?? v as unknown[]).includes(c.value);
  const n = Number(v);
  return c.op === "<" ? n < c.value : c.op === "<=" ? n <= c.value : c.op === "=" ? n === c.value : c.op === ">=" ? n >= c.value : n > c.value;
}

export function isAnswered(q: Question, v: unknown): boolean {
  if (q.type === "auto") return true;
  if (v === undefined || v === null || v === "") return false;
  if (q.type === "chips") {
    const value = v as { chips?: unknown[]; text?: string };
    return (value.chips?.length ?? 0) > 0 || Boolean(value.text?.trim());
  }
  if (q.type === "photos") return Object.values(v as object).some(Boolean);
  return true;
}

export function validateStep(step: Step, a: Answers, photosRequired = false): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of step.questions) {
    if (!isVisible(q, a)) continue;
    const required = q.required || (q.type === "photos" && photosRequired);
    if (required && !isAnswered(q, a[q.id])) errors[q.id] = "Συμπλήρωσε αυτό το πεδίο";
  }
  return errors;
}

export function computeScore(form: FormDefinition, a: Answers): { score: number | null; tier: ScoreTier | null } {
  let sum = 0;
  let max = 0;
  for (const step of form.steps) for (const q of step.questions) {
    if (q.type !== "scale" || !q.scored || !isVisible(q, a)) continue;
    const value = Number(a[q.id]);
    if (!value) continue;
    const weight = q.weight ?? 1;
    sum += value * weight;
    max += 5 * weight;
  }
  if (!max) return { score: null, tier: null };
  const score = Math.round((sum / max) * 100);
  return { score, tier: form.scoreTiers.find((tier) => score >= tier.min && score <= tier.max) ?? null };
}
