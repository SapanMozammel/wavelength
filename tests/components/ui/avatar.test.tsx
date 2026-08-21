import { getInitials, getToneIndex } from '@/components/ui/avatar';
import { describe, expect, it } from 'vitest';

/**
 * There is no avatar image anywhere in this API — users carry only an id, a
 * name, and a phone number — so the initials fallback is the only avatar that
 * ever renders. It has to survive whatever the API stored, and the API accepts
 * almost any name.
 */
describe('getInitials', () => {
	it('takes the first and last initial', () => {
		expect(getInitials('Ada Lovelace')).toBe('AL');
		expect(getInitials('Grace Brewster Murray Hopper')).toBe('GH');
	});

	it('falls back to a single initial for a one-word name', () => {
		expect(getInitials('Ada')).toBe('A');
	});

	it('renders a glyph rather than an empty circle for unusable names', () => {
		expect(getInitials('')).toBe('?');
		expect(getInitials('   ')).toBe('?');
	});

	it('tolerates the irregular whitespace a free-text field allows', () => {
		expect(getInitials('  ada   lovelace  ')).toBe('AL');
	});
});

describe('getToneIndex', () => {
	it('is stable, so one person is the same colour on every render and device', () => {
		expect(getToneIndex('6a888073e5d6aac97523611b')).toBe(getToneIndex('6a888073e5d6aac97523611b'));
	});

	it('stays inside the palette for any input', () => {
		for (const seed of ['', 'a', '6a888073e5d6aac97523611b', 'Ada Lovelace', '+15551234567']) {
			const index = getToneIndex(seed);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(5);
		}
	});
});
