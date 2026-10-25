import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormatUtils } from '../app/utils/FormatUtils.ts';
import { PointsUtils } from '../app/utils/PointsUtils.ts';

test('points follow the 3/1 rule and preserve zero', () => {
  assert.equal(PointsUtils.calculatePoints(0, 0), 0);
  assert.equal(PointsUtils.calculatePoints(4, 2), 14);
});

test('invalid counts and unsafe totals have no result', () => {
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(PointsUtils.calculatePoints(value, 0), undefined);
    assert.equal(PointsUtils.calculatePoints(0, value), undefined);
  }
  assert.equal(PointsUtils.calculatePoints(Number.MAX_SAFE_INTEGER, 1), undefined);
});

test('civil dates retain their calendar day in different server timezones', () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/Bogota', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      assert.equal(FormatUtils.formatDate('1986-04-12'), '12 de abril de 1986');
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
