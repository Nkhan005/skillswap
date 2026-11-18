'use strict';

const crypto = require('node:crypto');
const env = require('../config/env');

/**
 * Location privacy.
 *
 * ---------------------------------------------------------------------------
 * The problem this solves
 *
 * Matching needs to know where people are. Showing people on a map needs to
 * publish where they are. Those are not the same requirement, and conflating
 * them is how a community platform becomes a tool for finding somebody's
 * house.
 *
 * So: the database keeps the precise point, because honest distances depend on
 * it, and every distance in the UI is still computed from the real
 * coordinates. What leaves the server is deliberately blurred.
 *
 * ---------------------------------------------------------------------------
 * Why the offset is deterministic
 *
 * The obvious implementation adds a fresh random offset each time. That is
 * actively worse than doing nothing. An attacker simply requests the same
 * profile repeatedly and averages the results: random errors cancel out, and
 * a few hundred samples recover the true position to within a few metres.
 *
 * Deriving the offset from a hash of (user id + server secret) instead means:
 *   - the same user always lands on the same blurred point, so repeated
 *     sampling reveals nothing new;
 *   - the offset cannot be predicted or reversed without the server secret,
 *     so it cannot be subtracted back out;
 *   - the point stays put between page loads, which also happens to look
 *     correct rather than jittering around the map.
 * ---------------------------------------------------------------------------
 */

/** Metres of displacement applied at the default 'area' precision. */
const AREA_RADIUS_M = 450;

/** Rough metres per degree of latitude. Constant enough at any latitude. */
const METRES_PER_DEGREE_LAT = 111_320;

const PRECISION_LEVELS = ['area', 'city', 'hidden'];

/**
 * Turn an id into two stable numbers in [0, 1).
 *
 * HMAC rather than a plain hash: the secret is what stops someone who knows a
 * user's id from recomputing their offset and cancelling it.
 */
function stableUnitPair(id) {
  const digest = crypto
    .createHmac('sha256', env.LOCATION_SALT)
    .update(String(id))
    .digest();

  // Two independent 32-bit slices: one for direction, one for distance.
  const a = digest.readUInt32BE(0) / 0x100000000;
  const b = digest.readUInt32BE(4) / 0x100000000;

  return [a, b];
}

/**
 * Blur a point so it lands somewhere plausible nearby, never on the doorstep.
 *
 * @param {[number, number]} coordinates [lng, lat] as stored by Mongo
 * @param {string} userId used to derive the stable offset
 * @param {string} precision 'area' | 'city' | 'hidden'
 * @returns {[number, number] | null} blurred [lng, lat], or null if hidden
 */
function fuzzCoordinates(coordinates, userId, precision = 'area') {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  if (precision === 'hidden') return null;

  const [lng, lat] = coordinates.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const [angleSeed, radiusSeed] = stableUnitPair(userId);

  const angle = angleSeed * Math.PI * 2;

  // 'city' blurs by 8km, which places the pin somewhere in the right town
  // without suggesting a neighbourhood.
  const maxRadius = precision === 'city' ? 8_000 : AREA_RADIUS_M;

  // sqrt, not a bare multiply. Picking the radius uniformly would cluster
  // most offsets near the centre, because the area of a ring grows with r.
  // sqrt spreads them evenly across the disc, so the true point is no more
  // likely than any other spot inside it.
  const distance = Math.sqrt(radiusSeed) * maxRadius;

  const deltaLat = (distance * Math.sin(angle)) / METRES_PER_DEGREE_LAT;

  // Lines of longitude converge toward the poles, so a metre east is a larger
  // change in degrees the further from the equator you are. Without the
  // cos(lat) correction the blur would be squashed in Chennai and stretched
  // in Oslo.
  const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const deltaLng =
    metresPerDegreeLng > 1 ? (distance * Math.cos(angle)) / metresPerDegreeLng : 0;

  return [
    Number((lng + deltaLng).toFixed(5)),
    Number((lat + deltaLat).toFixed(5)),
  ];
}

/**
 * Strip a user object of anything that pinpoints them, and attach the blurred
 * point instead.
 *
 * This runs on every user object that leaves the matching endpoints. It
 * deletes `location` outright rather than overwriting it, so a field added to
 * the schema later cannot quietly start leaking through this function.
 */
function publicLocation(user) {
  if (!user) return user;

  const precision = PRECISION_LEVELS.includes(user.locationPrecision)
    ? user.locationPrecision
    : 'area';

  const approx = fuzzCoordinates(user.location?.coordinates, user._id, precision);

  const safe = { ...user };
  delete safe.location;

  safe.approxLocation = approx ? { type: 'Point', coordinates: approx } : null;
  safe.locationPrecision = precision;

  return safe;
}

module.exports = {
  fuzzCoordinates,
  publicLocation,
  PRECISION_LEVELS,
  AREA_RADIUS_M,
};
