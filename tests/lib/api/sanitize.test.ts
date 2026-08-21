import { sanitizeSearchTerm } from '@/lib/api';
import { describe, expect, it } from 'vitest';

/**
 * `GET /users/search` interpolates `q` straight into a Mongo `$regex`. A bare
 * `+` — the first character of every E.164 phone number — makes the endpoint
 * answer 500, which would break the assignment's "search by number" flow.
 */
describe('sanitizeSearchTerm', () => {
	it('strips the leading + that crashes the upstream regex', () => {
		expect(sanitizeSearchTerm('+15551234567')).toBe('15551234567');
	});

	it('strips every regex metacharacter', () => {
		expect(sanitizeSearchTerm('a*b?c(d)e[f]g')).toBe('abcdefg');
	});

	it('leaves ordinary names untouched', () => {
		expect(sanitizeSearchTerm('  Ada Lovelace  ')).toBe('Ada Lovelace');
	});

	it('collapses a whitespace-only query to empty, so the caller can skip the request', () => {
		expect(sanitizeSearchTerm('   ')).toBe('');
	});
});
