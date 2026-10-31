import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMinor,
  parseRupeesToMinor,
  minorToRupeeInput,
  formatBpToPercent,
  parsePercentToBp,
  checkPasswordRules,
} from './money';

test('formatMinor formats integer paise in en-IN INR currency', () => {
  assert.equal(formatMinor(0), '₹0.00');
  assert.equal(formatMinor(390344), '₹3,903.44');
  assert.equal(formatMinor(150000), '₹1,500.00');
  assert.equal(formatMinor(84210000), '₹8,42,100.00');
});

test('parseRupeesToMinor converts rupee strings to integer paise without floating point drift', () => {
  assert.equal(parseRupeesToMinor('19.99'), 1999);
  assert.equal(parseRupeesToMinor('1062.00'), 106200);
  assert.equal(parseRupeesToMinor('560.5'), 56050);
  assert.equal(parseRupeesToMinor('0'), 0);
  assert.equal(parseRupeesToMinor('-10'), null);
  assert.equal(parseRupeesToMinor('12.345'), null);
  assert.equal(parseRupeesToMinor('abc'), null);
});

test('minorToRupeeInput converts minor units back to clean input strings', () => {
  assert.equal(minorToRupeeInput(150000), '1500');
  assert.equal(minorToRupeeInput(106250), '1062.50');
});

test('basis points and percent conversions', () => {
  assert.equal(formatBpToPercent(1800), '18%');
  assert.equal(formatBpToPercent(1250), '12.5%');
  assert.equal(parsePercentToBp('18'), 1800);
  assert.equal(parsePercentToBp('12.5'), 1250);
  assert.equal(parsePercentToBp('invalid'), null);
});

test('checkPasswordRules enforces >8 chars, uppercase, lowercase, and special character', () => {
  assert.equal(checkPasswordRules('Short#1A').minLength, false);
  assert.equal(checkPasswordRules('Short#1A').isValid, false);

  const valid = checkPasswordRules('Strong#Pass1');
  assert.equal(valid.minLength, true);
  assert.equal(valid.hasUpper, true);
  assert.equal(valid.hasLower, true);
  assert.equal(valid.hasSpecial, true);
  assert.equal(valid.isValid, true);
});
