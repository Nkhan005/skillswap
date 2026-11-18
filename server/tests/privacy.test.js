'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LOCATION_SALT = process.env.LOCATION_SALT || 'test_salt_for_privacy_suite';

const { fuzzCoordinates, publicLocation, AREA_RADIUS_M } = require('../src/utils/privacy');

/** Great-circle distance in metres. Independent of the implementation. */
function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Hyderabad, roughly. Any point works; this one keeps the numbers readable.
const ORIGIN = [78.4867, 17.385];

test('the blurred point is never the real point', () => {
  const out = fuzzCoordinates(ORIGIN, 'user-a');

  assert.notDeepEqual(out, ORIGIN);
});

test('the blur stays within the advertised radius', () => {
  // Checked across many ids: a single id could pass by luck.
  for (let i = 0; i < 500; i += 1) {
    const out = fuzzCoordinates(ORIGIN, `user-${i}`);
    const moved = haversine(ORIGIN, out);

    assert.ok(
      moved <= AREA_RADIUS_M + 1,
      `user-${i} moved ${moved.toFixed(0)}m, beyond the ${AREA_RADIUS_M}m bound`
    );
  }
});

test('the blur is actually applied, not a token nudge', () => {
  // Guards against a regression that shrinks the offset to near zero and
  // still passes the upper-bound check above.
  const distances = [];
  for (let i = 0; i < 200; i += 1) {
    distances.push(haversine(ORIGIN, fuzzCoordinates(ORIGIN, `user-${i}`)));
  }
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;

  // sqrt-distributed radius over a disc has a mean of (2/3)r. Allow a wide
  // band so the test asserts the shape, not an exact constant.
  assert.ok(mean > AREA_RADIUS_M * 0.4, `mean offset ${mean.toFixed(0)}m is suspiciously small`);
});

test('the same user always lands on the same point', () => {
  // THE important property. A fresh random offset per request would let an
  // attacker average repeated samples and recover the true location, so a
  // regression here silently removes the protection.
  const first = fuzzCoordinates(ORIGIN, 'stable-user');

  for (let i = 0; i < 50; i += 1) {
    assert.deepEqual(fuzzCoordinates(ORIGIN, 'stable-user'), first);
  }
});

test('different users at the same address land on different points', () => {
  const a = fuzzCoordinates(ORIGIN, 'flatmate-a');
  const b = fuzzCoordinates(ORIGIN, 'flatmate-b');

  assert.notDeepEqual(a, b);
});

test('city precision blurs much further than area precision', () => {
  const area = haversine(ORIGIN, fuzzCoordinates(ORIGIN, 'u', 'area'));
  const city = haversine(ORIGIN, fuzzCoordinates(ORIGIN, 'u', 'city'));

  assert.ok(city > area, `city blur ${city.toFixed(0)}m should exceed area blur ${area.toFixed(0)}m`);
});

test('hidden precision publishes no coordinates at all', () => {
  assert.equal(fuzzCoordinates(ORIGIN, 'u', 'hidden'), null);
});

test('missing or malformed coordinates yield null rather than throwing', () => {
  assert.equal(fuzzCoordinates(undefined, 'u'), null);
  assert.equal(fuzzCoordinates([], 'u'), null);
  assert.equal(fuzzCoordinates([1], 'u'), null);
  assert.equal(fuzzCoordinates(['x', 'y'], 'u'), null);
});

test('the longitude correction holds near the poles', () => {
  // Without the cos(latitude) term the east-west blur collapses as longitude
  // lines converge, so a northern user would be pinned far more precisely
  // than a southern one.
  const arctic = [18.95, 69.65]; // Tromso
  const moved = haversine(arctic, fuzzCoordinates(arctic, 'arctic-user'));

  assert.ok(moved <= AREA_RADIUS_M + 1, `moved ${moved.toFixed(0)}m near the pole`);
  assert.ok(moved > 1, 'offset collapsed to nothing at high latitude');
});

test('publicLocation removes the precise point entirely', () => {
  const user = {
    _id: 'abc123',
    name: 'Gowthami',
    location: { type: 'Point', coordinates: ORIGIN },
  };

  const safe = publicLocation(user);

  assert.equal(safe.location, undefined, 'the precise point must not survive');
  assert.ok(safe.approxLocation, 'an approximate point should be published');
  assert.notDeepEqual(safe.approxLocation.coordinates, ORIGIN);
});

test('publicLocation does not mutate the document it was given', () => {
  // The caller may still need the true coordinates to compute distance.
  const user = { _id: 'abc123', location: { type: 'Point', coordinates: ORIGIN } };

  publicLocation(user);

  assert.deepEqual(user.location.coordinates, ORIGIN);
});

test('publicLocation honours a hidden preference', () => {
  const user = {
    _id: 'abc123',
    locationPrecision: 'hidden',
    location: { type: 'Point', coordinates: ORIGIN },
  };

  const safe = publicLocation(user);

  assert.equal(safe.approxLocation, null);
  assert.equal(safe.location, undefined);
});

test('an unknown precision value falls back to the safest supported one', () => {
  const user = {
    _id: 'abc123',
    locationPrecision: 'exact-please',
    location: { type: 'Point', coordinates: ORIGIN },
  };

  const safe = publicLocation(user);

  assert.equal(safe.locationPrecision, 'area');
  assert.ok(safe.approxLocation);
  assert.notDeepEqual(safe.approxLocation.coordinates, ORIGIN);
});

test('a user with no location survives without coordinates', () => {
  const safe = publicLocation({ _id: 'abc123', name: 'No Location' });

  assert.equal(safe.approxLocation, null);
  assert.equal(safe.name, 'No Location');
});
