export function isVisible(question, answers) {
  const condition = question.showIf;
  if (!condition) return true;
  const value = answers[condition.questionId];
  if (value === undefined || value === null || value === '') return false;
  if (condition.op === 'is') return value === condition.value;
  if (condition.op === 'includes') {
    const values = Array.isArray(value?.chips ?? value) ? (value.chips ?? value) : [];
    return values.includes(condition.value);
  }
  const number = Number(value);
  return condition.op === '<' ? number < condition.value
    : condition.op === '<=' ? number <= condition.value
      : condition.op === '=' ? number === condition.value
        : condition.op === '>=' ? number >= condition.value
          : number > condition.value;
}

export function isAnswered(question, value) {
  if (question.type === 'auto') return true;
  if (value === undefined || value === null || value === '') return false;
  if (question.type === 'chips') return (value?.chips?.length ?? 0) > 0 || Boolean(value?.text?.trim());
  if (question.type === 'photos') return Object.values(value).some(Boolean);
  return true;
}

export function validateStep(step, answers, photosRequired = false) {
  const errors = {};
  for (const question of step.questions) {
    if (!isVisible(question, answers)) continue;
    const required = question.required || (question.type === 'photos' && photosRequired);
    if (required && !isAnswered(question, answers[question.id])) errors[question.id] = 'Συμπλήρωσε αυτό το πεδίο';
  }
  return errors;
}

export function computeScore(form, answers) {
  let sum = 0;
  let max = 0;
  for (const step of form.steps) for (const question of step.questions) {
    if (question.type !== 'scale' || !question.scored || !isVisible(question, answers)) continue;
    const value = Number(answers[question.id]);
    if (!value) continue;
    const weight = question.weight ?? 1;
    sum += value * weight;
    max += 5 * weight;
  }
  if (!max) return { score: null, tier: null };
  const score = Math.round((sum / max) * 100);
  return { score, tier: form.scoreTiers.find((tier) => score >= tier.min && score <= tier.max) ?? null };
}
