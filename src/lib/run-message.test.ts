import { expect, it } from 'vitest';

import { runMessage } from './run-message';

it('maps every run result to a message, except skipped', () => {
  expect(runMessage('skipped')).toBeNull();
  for (const r of ['done', 'downloaded', 'needs-access', 'missing'] as const) expect(runMessage(r)).toBeTruthy();
});
