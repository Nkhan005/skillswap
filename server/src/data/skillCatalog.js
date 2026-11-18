'use strict';

/**
 * The curated skill taxonomy.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 *
 * Skill names used to be free text. The matching engine compares them after
 * lowercasing and collapsing whitespace, which means these are five different
 * skills as far as the database is concerned:
 *
 *     JS    Javascript    java script    ReactJS    React.js
 *
 * Five members who all know JavaScript therefore do not match each other. The
 * matching engine was never wrong - it was being fed data that could not be
 * matched. No amount of scoring cleverness fixes a vocabulary problem.
 *
 * A canonical list with aliases fixes it at the source: every spelling above
 * resolves to one entry, and the existing mutual-overlap logic starts working
 * the way it was always meant to.
 *
 * ---------------------------------------------------------------------------
 * Why a file rather than a collection
 *
 * This is reference data, not user data. It changes when a human decides it
 * should, it needs to be reviewable in a pull request, and it must be
 * identical across every environment. A seeded collection would drift between
 * local, CI and production, and the drift would show up as matching bugs that
 * only reproduce on one machine.
 *
 * Members can still enter something not on this list - see resolveSkillName.
 * The list raises the floor; it is not a cage.
 * ---------------------------------------------------------------------------
 */

/**
 * Each entry: canonical display name, its category, and the spellings people
 * actually type. Aliases are matched after normalisation, so case and
 * punctuation spacing do not need separate entries.
 */
const SKILLS = [
  // --- Technology ---------------------------------------------------------
  { name: 'JavaScript', category: 'Technology', aliases: ['js', 'ecmascript', 'java script', 'vanilla js'] },
  { name: 'TypeScript', category: 'Technology', aliases: ['ts'] },
  { name: 'React', category: 'Technology', aliases: ['reactjs', 'react js', 'react.js'] },
  { name: 'Node.js', category: 'Technology', aliases: ['node', 'nodejs', 'node js'] },
  { name: 'Python', category: 'Technology', aliases: ['py', 'python3'] },
  { name: 'Java', category: 'Technology', aliases: [] },
  { name: 'C++', category: 'Technology', aliases: ['cpp', 'c plus plus'] },
  { name: 'C', category: 'Technology', aliases: ['c language'] },
  { name: 'SQL', category: 'Technology', aliases: ['mysql', 'postgresql', 'postgres', 'databases'] },
  { name: 'MongoDB', category: 'Technology', aliases: ['mongo', 'nosql'] },
  { name: 'HTML & CSS', category: 'Technology', aliases: ['html', 'css', 'html5', 'css3', 'web design'] },
  { name: 'Git & GitHub', category: 'Technology', aliases: ['git', 'github', 'version control'] },
  { name: 'Docker', category: 'Technology', aliases: ['containers', 'containerisation'] },
  { name: 'Linux', category: 'Technology', aliases: ['ubuntu', 'bash', 'shell scripting', 'unix'] },
  { name: 'Data Structures & Algorithms', category: 'Technology', aliases: ['dsa', 'algorithms', 'data structures', 'leetcode'] },
  { name: 'Machine Learning', category: 'Technology', aliases: ['ml', 'deep learning', 'ai', 'artificial intelligence'] },
  { name: 'Data Analysis', category: 'Technology', aliases: ['data science', 'pandas', 'numpy', 'analytics'] },
  { name: 'Android Development', category: 'Technology', aliases: ['android', 'kotlin', 'android studio'] },
  { name: 'iOS Development', category: 'Technology', aliases: ['ios', 'swift', 'swiftui'] },
  { name: 'Cybersecurity', category: 'Technology', aliases: ['security', 'ethical hacking', 'infosec', 'pentesting'] },
  { name: 'Cloud & DevOps', category: 'Technology', aliases: ['aws', 'azure', 'devops', 'kubernetes', 'ci/cd', 'jenkins'] },
  { name: 'Excel & Spreadsheets', category: 'Technology', aliases: ['excel', 'google sheets', 'spreadsheets', 'advanced excel'] },

  // --- Design -------------------------------------------------------------
  { name: 'Graphic Design', category: 'Design', aliases: ['graphics', 'poster design', 'canva'] },
  { name: 'UI/UX Design', category: 'Design', aliases: ['ui', 'ux', 'ui ux', 'product design', 'user experience'] },
  { name: 'Figma', category: 'Design', aliases: ['figma design'] },
  { name: 'Photoshop', category: 'Design', aliases: ['adobe photoshop', 'photo editing', 'ps'] },
  { name: 'Illustration', category: 'Design', aliases: ['drawing', 'sketching', 'digital art', 'doodling'] },
  { name: 'Video Editing', category: 'Design', aliases: ['premiere pro', 'video', 'capcut', 'davinci resolve'] },
  { name: 'Animation', category: 'Design', aliases: ['motion graphics', 'after effects', '2d animation'] },
  { name: '3D Modelling', category: 'Design', aliases: ['blender', '3d', 'cad', 'autocad'] },
  { name: 'Photography', category: 'Design', aliases: ['photo', 'dslr', 'portrait photography'] },

  // --- Languages ----------------------------------------------------------
  { name: 'English', category: 'Languages', aliases: ['spoken english', 'english speaking', 'english grammar'] },
  { name: 'Hindi', category: 'Languages', aliases: [] },
  { name: 'Telugu', category: 'Languages', aliases: [] },
  { name: 'Tamil', category: 'Languages', aliases: [] },
  { name: 'Kannada', category: 'Languages', aliases: [] },
  { name: 'Malayalam', category: 'Languages', aliases: [] },
  { name: 'Marathi', category: 'Languages', aliases: [] },
  { name: 'Bengali', category: 'Languages', aliases: ['bangla'] },
  { name: 'Urdu', category: 'Languages', aliases: [] },
  { name: 'Spanish', category: 'Languages', aliases: ['espanol'] },
  { name: 'French', category: 'Languages', aliases: [] },
  { name: 'German', category: 'Languages', aliases: ['deutsch'] },
  { name: 'Japanese', category: 'Languages', aliases: ['nihongo'] },
  { name: 'Sign Language', category: 'Languages', aliases: ['isl', 'asl'] },

  // --- Music --------------------------------------------------------------
  { name: 'Guitar', category: 'Music', aliases: ['acoustic guitar', 'electric guitar'] },
  { name: 'Piano', category: 'Music', aliases: ['keyboard'] },
  { name: 'Singing', category: 'Music', aliases: ['vocals', 'vocal training', 'carnatic', 'hindustani'] },
  { name: 'Drums', category: 'Music', aliases: ['percussion', 'tabla'] },
  { name: 'Violin', category: 'Music', aliases: [] },
  { name: 'Flute', category: 'Music', aliases: ['bansuri'] },
  { name: 'Music Production', category: 'Music', aliases: ['fl studio', 'ableton', 'beat making', 'mixing'] },
  { name: 'DJing', category: 'Music', aliases: ['dj'] },

  // --- Academics ----------------------------------------------------------
  { name: 'Mathematics', category: 'Academics', aliases: ['maths', 'math', 'calculus', 'algebra'] },
  { name: 'Physics', category: 'Academics', aliases: [] },
  { name: 'Chemistry', category: 'Academics', aliases: [] },
  { name: 'Biology', category: 'Academics', aliases: ['bio'] },
  { name: 'Statistics', category: 'Academics', aliases: ['stats', 'probability'] },
  { name: 'Economics', category: 'Academics', aliases: ['eco', 'micro economics', 'macro economics'] },
  { name: 'Accountancy', category: 'Academics', aliases: ['accounting', 'tally', 'bookkeeping'] },
  { name: 'History', category: 'Academics', aliases: [] },
  { name: 'Competitive Exam Prep', category: 'Academics', aliases: ['gate', 'jee', 'neet', 'upsc', 'cat', 'gre'] },
  { name: 'Academic Writing', category: 'Academics', aliases: ['essay writing', 'research writing', 'thesis'] },

  // --- Fitness ------------------------------------------------------------
  { name: 'Yoga', category: 'Fitness', aliases: ['asana', 'hatha yoga'] },
  { name: 'Gym & Strength Training', category: 'Fitness', aliases: ['gym', 'weight training', 'bodybuilding', 'strength'] },
  { name: 'Running', category: 'Fitness', aliases: ['jogging', 'marathon training'] },
  { name: 'Cricket', category: 'Fitness', aliases: [] },
  { name: 'Football', category: 'Fitness', aliases: ['soccer'] },
  { name: 'Badminton', category: 'Fitness', aliases: [] },
  { name: 'Swimming', category: 'Fitness', aliases: [] },
  { name: 'Martial Arts', category: 'Fitness', aliases: ['karate', 'taekwondo', 'self defence', 'boxing'] },
  { name: 'Dance', category: 'Fitness', aliases: ['dancing', 'hip hop', 'classical dance', 'bharatanatyam', 'zumba'] },
  { name: 'Meditation', category: 'Fitness', aliases: ['mindfulness', 'breathing'] },

  // --- Business -----------------------------------------------------------
  { name: 'Public Speaking', category: 'Business', aliases: ['presentation skills', 'speaking', 'debate'] },
  { name: 'Digital Marketing', category: 'Business', aliases: ['seo', 'social media marketing', 'marketing', 'ads'] },
  { name: 'Content Writing', category: 'Business', aliases: ['copywriting', 'blogging', 'writing'] },
  { name: 'Entrepreneurship', category: 'Business', aliases: ['startups', 'business planning'] },
  { name: 'Personal Finance', category: 'Business', aliases: ['investing', 'budgeting', 'stock market', 'mutual funds'] },
  { name: 'Project Management', category: 'Business', aliases: ['agile', 'scrum', 'pm'] },
  { name: 'Resume & Interview Prep', category: 'Business', aliases: ['resume', 'cv', 'interview', 'mock interview'] },
  { name: 'Video Content Creation', category: 'Business', aliases: ['youtube', 'reels', 'content creation', 'vlogging'] },

  // --- Crafts -------------------------------------------------------------
  { name: 'Knitting & Crochet', category: 'Crafts', aliases: ['knitting', 'crochet'] },
  { name: 'Embroidery', category: 'Crafts', aliases: ['stitching', 'needlework'] },
  { name: 'Tailoring', category: 'Crafts', aliases: ['sewing', 'dressmaking'] },
  { name: 'Pottery', category: 'Crafts', aliases: ['ceramics', 'clay'] },
  { name: 'Woodworking', category: 'Crafts', aliases: ['carpentry'] },
  { name: 'Origami', category: 'Crafts', aliases: ['paper craft'] },
  { name: 'Painting', category: 'Crafts', aliases: ['acrylic painting', 'watercolour', 'oil painting', 'canvas painting'] },
  { name: 'Calligraphy', category: 'Crafts', aliases: ['hand lettering', 'handwriting'] },
  { name: 'Gardening', category: 'Crafts', aliases: ['plants', 'terrace garden', 'horticulture'] },

  // --- Cooking ------------------------------------------------------------
  { name: 'Home Cooking', category: 'Cooking', aliases: ['cooking', 'everyday cooking'] },
  { name: 'Baking', category: 'Cooking', aliases: ['cakes', 'bread making', 'pastry'] },
  { name: 'South Indian Cuisine', category: 'Cooking', aliases: ['south indian', 'dosa', 'idli'] },
  { name: 'North Indian Cuisine', category: 'Cooking', aliases: ['north indian', 'punjabi cooking'] },
  { name: 'Hyderabadi Cuisine', category: 'Cooking', aliases: ['biryani', 'hyderabadi'] },
  { name: 'Continental Cuisine', category: 'Cooking', aliases: ['italian', 'pasta', 'continental'] },
  { name: 'Chinese Cuisine', category: 'Cooking', aliases: ['chinese', 'indo chinese'] },
  { name: 'Healthy Eating', category: 'Cooking', aliases: ['nutrition', 'meal prep', 'diet planning'] },
  { name: 'Barista Skills', category: 'Cooking', aliases: ['coffee', 'latte art'] },
];

/**
 * Normalise for comparison: lowercase, collapse runs of whitespace, trim.
 *
 * Kept identical to the normalisation in utils/matching.js. If the two ever
 * diverge, a skill could resolve to a canonical name that the matcher then
 * fails to match - the exact class of bug this file exists to remove.
 */
function normalise(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lookup table built once at module load: every canonical name and every
 * alias, normalised, pointing at its catalog entry.
 *
 * A Map rather than a repeated .find(): resolution runs for every skill on
 * every profile save and every catalog request, and a linear scan over ~100
 * entries with ~250 aliases adds up.
 */
const LOOKUP = new Map();
for (const skill of SKILLS) {
  LOOKUP.set(normalise(skill.name), skill);
  for (const alias of skill.aliases) LOOKUP.set(normalise(alias), skill);
}

/**
 * Resolve whatever a member typed to its canonical form.
 *
 * Returns the catalog entry when recognised. When it is not, the input is
 * returned as a custom skill rather than rejected: a platform that only
 * accepts skills from a list someone wrote in advance cannot represent what
 * its members actually know, and the first person who teaches something
 * genuinely new should not be turned away.
 */
function resolveSkillName(input) {
  const key = normalise(input);
  if (!key) return null;

  const hit = LOOKUP.get(key);
  if (hit) return { name: hit.name, category: hit.category, custom: false };

  // Preserve the member's own capitalisation, trimmed of excess whitespace.
  return { name: String(input).replace(/\s+/g, ' ').trim(), category: 'Other', custom: true };
}

/** Catalog grouped by category, for the picker UI. */
function catalogByCategory() {
  const groups = new Map();

  for (const skill of SKILLS) {
    if (!groups.has(skill.category)) groups.set(skill.category, []);
    groups.get(skill.category).push({ name: skill.name, aliases: skill.aliases });
  }

  return [...groups.entries()].map(([category, skills]) => ({ category, skills }));
}

module.exports = { SKILLS, resolveSkillName, catalogByCategory, normalise };
