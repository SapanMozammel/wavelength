import { formatPhoneAsYouType, formatPhoneForDisplay, isValidPhone, normalizePhone } from '@/lib/utils/phone';
import { describe, expect, it } from 'vitest';

/**
 * A phone number is this app's primary key for identity: `POST /auth/login`
 * registers an unseen number and logs in a known one, and `GET /users/search`
 * matches against the stored string. So a number stored in one format and
 * searched in another is an account nobody can find — and the API will never
 * report it, because both operations succeed.
 *
 * These tests pin the one rule that prevents it: whatever the user types, what
 * reaches the server is E.164 — and the gate refuses what cannot work rather
 * than what merely looks unusual.
 */
describe('normalizePhone', () => {
	it('reduces spaced, dashed, and bracketed input to one canonical E.164 string', () => {
		const expected = '+15551234567';
		expect(normalizePhone('+1 555 123 4567')).toBe(expected);
		expect(normalizePhone('+1 (555) 123-4567')).toBe(expected);
		expect(normalizePhone('  +15551234567  ')).toBe(expected);
	});

	it('normalizes a non-US number just as readily', () => {
		expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
		expect(normalizePhone('+880 1712 345678')).toBe('+8801712345678');
	});

	it('accepts the +1555 block, which the live API already holds accounts on', () => {
		// libphonenumber classifies this range as unassigned, so a strict
		// validity check would reject it. The API has no validation and real
		// accounts exist on these numbers (docs/api/README.md), so refusing
		// them would lock a user out of an account the server would happily
		// log them into.
		expect(normalizePhone('+1 555 123 4567')).toBe('+15551234567');
		expect(isValidPhone('+15559990001')).toBe(true);
	});

	it('rejects a number with no country code rather than guessing one', () => {
		// Guessing a region from the browser locale would silently create the
		// account under the wrong calling code, which is worse than refusing.
		expect(normalizePhone('5551234567')).toBeNull();
		expect(normalizePhone('015551234567')).toBeNull();
	});

	it('rejects input that is not a real number', () => {
		expect(normalizePhone('+1')).toBeNull();
		expect(normalizePhone('+1555')).toBeNull();
		expect(normalizePhone('not a phone')).toBeNull();
		expect(normalizePhone('')).toBeNull();
		expect(normalizePhone('   ')).toBeNull();
	});

	it('is idempotent, so re-normalizing a stored number is safe', () => {
		const once = normalizePhone('+1 555 123 4567');
		expect(once).not.toBeNull();
		expect(normalizePhone(once as string)).toBe(once);
	});
});

describe('isValidPhone', () => {
	it('accepts a complete international number', () => {
		expect(isValidPhone('+1 202 555 0143')).toBe(true);
		expect(isValidPhone('+442079460958')).toBe(true);
	});

	it('rejects anything the composer must not be allowed to submit', () => {
		expect(isValidPhone('5551234567')).toBe(false);
		expect(isValidPhone('+1')).toBe(false);
		expect(isValidPhone('')).toBe(false);
		expect(isValidPhone('+')).toBe(false);
	});

	it('agrees with normalizePhone, so the submit gate and the payload cannot disagree', () => {
		for (const input of ['+15551234567', '5551234567', '+1', 'nonsense', '+44 20 7946 0958', '+880 1712 345678', '']) {
			expect(isValidPhone(input)).toBe(normalizePhone(input) !== null);
		}
	});
});

describe('formatPhoneAsYouType', () => {
	it('formats progressively while the user is still typing', () => {
		expect(formatPhoneAsYouType('+1555')).toBe('+1 555');
		expect(formatPhoneAsYouType('+15551234567')).toBe('+1 555 123 4567');
	});

	it('never throws on partial or empty input', () => {
		expect(() => formatPhoneAsYouType('')).not.toThrow();
		expect(() => formatPhoneAsYouType('+')).not.toThrow();
		expect(formatPhoneAsYouType('')).toBe('');
	});

	it('does not carry state between calls', () => {
		formatPhoneAsYouType('+442079460958');
		expect(formatPhoneAsYouType('+1555')).toBe('+1 555');
	});
});

describe('formatPhoneForDisplay', () => {
	it('renders a stored E.164 number readably', () => {
		expect(formatPhoneForDisplay('+15551234567')).toBe('+1 555 123 4567');
	});

	it('passes through anything it cannot parse rather than rendering nothing', () => {
		expect(formatPhoneForDisplay('whatever the server stored')).toBe('whatever the server stored');
	});
});
