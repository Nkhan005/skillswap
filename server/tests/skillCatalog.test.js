'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SKILLS,
  resolveSkillName,
  catalogByCategory,
  normalise,
} = require('../src/data/skillCatalog');

test('the five spellings of JavaScript all collapse to one skill', () => {
  // The exact failure this taxonomy exists to fix: these were five separate
  // skills, so five members who all knew JavaScript never matched.
  const spellings = ['JS', 'javascript', 'Java Script', 'JavaScript', 'js'];

  const resolved = spellings.map((s) => resolveSkillName(s).name);

  assert.deepEqual(new Set(resolved), new Set(['JavaScript']));
});

test('React spellings collapse, and do not collide with JavaScript', () => {
  // Related but distinct: over-merging would be its own bug.
  assert.equal(resolveSkillName('reactjs').name, 'React');
  assert.equal(resolveSkillName('React.js').name, 'React');
  assert.notEqual(resolveSkillName('react').name, resolveSkillName('js').name);
});

test('a resolved skill carries its category', () => {
  assert.equal(resolveSkillName('biryani').category, 'Cooking');
  assert.equal(resolveSkillName('dsa').category, 'Technology');
  assert.equal(resolveSkillName('bharatanatyam').category, 'Fitness');
});

test('an unknown skill is kept rather than rejected', () => {
  // A platform that only accepts skills from a pre-written list cannot
  // represent what its members actually know.
  const resolved = resolveSkillName('Competitive Kite Flying');

  assert.equal(resolved.name, 'Competitive Kite Flying');
  assert.equal(resolved.custom, true);
  assert.equal(resolved.category, 'Other');
});

test('a custom skill keeps the member capitalisation but loses stray spacing', () => {
  assert.equal(resolveSkillName('  Vedic   Astrology  ').name, 'Vedic Astrology');
});

test('a recognised skill is marked as not custom', () => {
  assert.equal(resolveSkillName('yoga').custom, false);
});

test('empty input resolves to nothing rather than an empty skill', () => {
  // Without this an empty form field becomes a skill named '' that silently
  // matches every other empty one.
  assert.equal(resolveSkillName(''), null);
  assert.equal(resolveSkillName('   '), null);
  assert.equal(resolveSkillName(null), null);
  assert.equal(resolveSkillName(undefined), null);
});

test('no alias is claimed by two different skills', () => {
  // An alias pointing at two canonical names would make resolution depend on
  // array order, so the same input could resolve differently after an edit.
  const seen = new Map();
  const clashes = [];

  for (const skill of SKILLS) {
    for (const alias of [skill.name, ...skill.aliases]) {
      const key = normalise(alias);
      if (seen.has(key) && seen.get(key) !== skill.name) {
        clashes.push(`"${alias}" claimed by both ${seen.get(key)} and ${skill.name}`);
      }
      seen.set(key, skill.name);
    }
  }

  assert.deepEqual(clashes, [], clashes.join('; '));
});

test('every skill sits in a category the User model recognises', () => {
  // The schema enum would otherwise reject a saved profile at write time,
  // which surfaces as a confusing validation error on an unrelated field.
  const VALID = [
    'Technology', 'Design', 'Languages', 'Music', 'Academics',
    'Fitness', 'Business', 'Crafts', 'Cooking', 'Other',
  ];

  const bad = SKILLS.filter((s) => !VALID.includes(s.category)).map((s) => s.name);

  assert.deepEqual(bad, []);
});

test('no canonical skill name is duplicated', () => {
  const names = SKILLS.map((s) => s.name);

  assert.equal(new Set(names).size, names.length);
});

test('the catalog groups every skill under a category', () => {
  const grouped = catalogByCategory();
  const total = grouped.reduce((sum, g) => sum + g.skills.length, 0);

  assert.equal(total, SKILLS.length);
  assert.ok(grouped.length >= 8, 'expected most categories to be represented');
});

test('normalise matches the matching engine rules', () => {
  // If these two normalisations drift apart, a skill resolves to a canonical
  // name that the matcher then fails to match - the bug this file prevents.
  assert.equal(normalise('  Public   SPEAKING '), 'public speaking');
});
