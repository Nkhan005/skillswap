// Loaded by Vitest before every test file (see `test.setupFiles` in
// vite.config.js).
//
// jest-dom adds DOM-aware assertions on top of Vitest's `expect`, so a test
// can say `expect(el).toBeVisible()` instead of hand-checking style and
// attribute values. The matchers describe intent, and their failure messages
// name what was actually rendered.
import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library mounts each component into a container appended to
// document.body. Without this, containers accumulate across tests in the same
// file and a query like getByRole('button') starts matching a button left
// behind by an earlier test - which looks like a mysteriously flaky suite.
afterEach(cleanup);
