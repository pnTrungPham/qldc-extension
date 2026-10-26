import { sprintf as wpSprintf } from '@wordpress/i18n';

/** Positional args (`%1$s`) defeat @wordpress/i18n's typed sprintf; keep the plugin's loose signature. */
const sprintf = wpSprintf as (format: string, ...args: Array<string | number>) => string;

/** Temporary passthrough until translations load (Task 2). */
export const i18n = {
  __: (text: string, _domain: string) => text,
  _n: (single: string, plural: string, count: number, _domain: string) => (count === 1 ? single : plural),
  sprintf,
};
