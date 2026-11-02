import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDurationDiscount, calculateDurationSavingCents, calculatePackagePriceCents } from '../src/lib/packages.js'

test('οι διάρκειες Βασικού δίνουν ακριβώς την τιμή, έκπτωση και εξοικονόμηση', () => {
  const oneMonth = 10500
  const rows = [[1, 10500, 0, 0], [2, 19000, 10, 2000], [3, 27000, 14, 4500], [4, 35000, 17, 7000]]
  for (const [months, price, discount, saving] of rows) {
    assert.equal(calculatePackagePriceCents({ basePriceCents: price, months }), price)
    assert.equal(calculateDurationDiscount(price, oneMonth, months), discount)
    assert.equal(calculateDurationSavingCents(price, oneMonth, months), saving)
  }
})

test('η αναβάθμιση προστίθεται πάντα ανά μήνα', () => {
  assert.equal(calculatePackagePriceCents({ basePriceCents: 27000, monthlyAddonCents: 3500, months: 3 }), 37500)
})
