import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, isVisible, validateStep } from '../src/lib/update-form/logic.js';

const tiers = [{ min: 75, max: 89, title: 'Πολύ καλή εβδομάδα', message: 'ok' }];
const scoreForm = { scoreTiers: tiers, steps: [{ id: 'a', questions: ['diet_score', 'training_score', 'sleep_quality', 'recovery'].map((id) => ({ id, type: 'scale', scored: true, required: true, showToCoach: true })) }] };

test('computeScore: 4,4,3,5 gives 80 and the expected tier', () => {
  const result = computeScore(scoreForm, { diet_score: 4, training_score: 4, sleep_quality: 3, recovery: 5 });
  assert.equal(result.score, 80);
  assert.equal(result.tier?.title, 'Πολύ καλή εβδομάδα');
});

test('isVisible supports every condition operator', () => {
  const base = { id: 'target', type: 'text', required: false, showToCoach: true };
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '<', value: 4 } }, { n: 3 }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '<=', value: 3 } }, { n: 3 }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '=', value: 3 } }, { n: 3 }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '>=', value: 3 } }, { n: 3 }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '>', value: 2 } }, { n: 3 }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'yes', op: 'is', value: true } }, { yes: true }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'chips', op: 'includes', value: 'Πόνος' } }, { chips: { chips: ['Πόνος'] } }), true);
  assert.equal(isVisible({ ...base, showIf: { questionId: 'n', op: '>', value: 2 } }, {}), false);
});

test('validateStep does not require a hidden required question', () => {
  const step = { id: 'health', questions: [{ id: 'details', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'changed', op: 'is', value: true } }] };
  assert.deepEqual(validateStep(step, { changed: false }), {});
});
