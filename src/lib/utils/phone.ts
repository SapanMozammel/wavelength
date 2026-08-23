import { AsYouType, isPossiblePhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Phone-number handling.
 *
 * A phone number is this app's primary key for identity — `POST /auth/login`
 * registers an unseen number and logs in a known one, with no password anywhere
 * in the system. Two consequences drive everything here:
 *
 * 1. **What reaches the server must always be E.164.** `GET /users/search`
 *    substring-matches the stored string, so a number saved as `+1 555 123 4567`
 *    and searched as `15551234567` is an account nobody can find. Neither
 *    request fails, so the bug is invisible until a second user looks for you.
 * 2. **A country code is required, never inferred.** Guessing a region from the
 *    browser locale would silently register the account under the wrong calling
 *    code. Refusing the input and asking for a `+` prefix is the honest failure.
 *
 * **Possible, not valid.** These helpers check that a number is *structurally
 * possible* for its calling code — right shape, right length — rather than that
 * its range is actually assigned by the carrier. That distinction matters here:
 * `libphonenumber` classifies the whole `+1555…` block as unassigned, and the
 * live API already holds accounts on those numbers (see `docs/api/README.md`).
 * Strict validation would lock a user out of an account the server is perfectly
 * happy to log them into, while catching nothing a possibility check misses —
 * a missing country code, a truncated number, and outright junk are all still
 * rejected. The API performs no validation of its own, so this is the only gate,
 * and it should refuse what cannot work rather than what merely looks unusual.
 *
 * The `/min` metadata bundle is used deliberately: it is roughly a third of the
 * size of the full build, and this app needs parsing, formatting, and length
 * checking — not the line-type classification the larger bundles carry.
 */

/** An explicit international prefix is required; see rule 2 above. */
const hasCountryCode = (input: string): boolean => input.trim().startsWith('+');

/**
 * Canonical E.164 for storage and transport, or `null` when the input is not a
 * structurally possible international number. Always call this before sending a
 * number to the API — never send raw field input.
 */
export const normalizePhone = (input: string): string | null => {
	const trimmed = input.trim();
	if (!hasCountryCode(trimmed)) {
		return null;
	}
	const parsed = parsePhoneNumberFromString(trimmed);
	return parsed?.isPossible() === true ? parsed.number : null;
};

/**
 * Submit-gate predicate. Deliberately agrees with `normalizePhone` for every
 * input — a gate that accepts what the normalizer rejects would send `null` to
 * the server.
 */
export const isValidPhone = (input: string): boolean => {
	const trimmed = input.trim();
	return hasCountryCode(trimmed) && isPossiblePhoneNumber(trimmed);
};

/**
 * Progressive formatting for a live input. A fresh `AsYouType` per call — the
 * formatter is stateful, and a shared instance would carry digits between
 * keystrokes and across unrelated fields.
 */
export const formatPhoneAsYouType = (input: string): string => new AsYouType().input(input);

/**
 * Readable form of a stored number. Falls back to the input unchanged: the API
 * accepts almost any string, so a number stored before this normalizer existed
 * must still render as itself rather than as an empty cell.
 */
export const formatPhoneForDisplay = (stored: string): string => parsePhoneNumberFromString(stored)?.formatInternational() ?? stored;
