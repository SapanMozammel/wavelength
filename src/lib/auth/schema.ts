import { isValidPhone } from '@/lib/utils/phone';
import { z } from 'zod';

/**
 * The login form's contract.
 *
 * Two libraries, one job each: `zod` owns the shape and the user-facing
 * messages, `libphonenumber-js` owns whether a phone number can exist. Keeping
 * the split explicit stops a second, weaker phone rule from growing here — the
 * API performs no validation of its own, so `isValidPhone` is the only gate
 * between a typo and an account nobody can find.
 *
 * The messages are deliberately instructive rather than diagnostic: "Include
 * the country code" tells the user what to do, "Invalid phone number" does not.
 */

/** Long enough for a real name, short enough that the row never wraps twice. */
export const NAME_MAX_LENGTH = 60;

const PHONE_REQUIRED = 'Enter your phone number.';
const PHONE_INVALID = 'Include the country code, like +1 555 123 4567.';
const NAME_REQUIRED = 'Enter the name other people will see.';
const NAME_TOO_LONG = `Keep your name to ${NAME_MAX_LENGTH} characters or fewer.`;
const FALLBACK_INVALID = 'That value is not valid.';

const phoneSchema = z.string().trim().min(1, PHONE_REQUIRED).refine(isValidPhone, PHONE_INVALID);

const nameSchema = z.string().trim().min(1, NAME_REQUIRED).max(NAME_MAX_LENGTH, NAME_TOO_LONG);

export const loginSchema = z.object({ phone: phoneSchema, name: nameSchema });

export type LoginValues = z.infer<typeof loginSchema>;

/** The fields the form owns — also the set the server is allowed to blame. */
export type LoginField = keyof LoginValues;

const LOGIN_FIELDS: readonly string[] = ['phone', 'name'];

/**
 * Narrows an `error.details[].path` from the API onto a field this form
 * renders. The upstream server is free to blame a path the form has no input
 * for, and such an error must surface in the form-level alert rather than
 * vanish into a field that does not exist.
 */
export const isLoginField = (path: string): path is LoginField => LOGIN_FIELDS.includes(path);

/** `null` when the value passes — so callers can treat "no error" as falsy-safe. */
export type LoginFieldErrors = Record<LoginField, string | null>;

const validateWith = (schema: z.ZodType<string>, value: string): string | null => {
	const result = schema.safeParse(value);
	return result.success ? null : (result.error.issues.at(0)?.message ?? FALLBACK_INVALID);
};

export const validatePhoneField = (value: string): string | null => validateWith(phoneSchema, value);

export const validateNameField = (value: string): string | null => validateWith(nameSchema, value);

export const validateLoginFields = (values: { phone: string; name: string }): LoginFieldErrors => ({
	phone: validatePhoneField(values.phone),
	name: validateNameField(values.name),
});

export const hasFieldError = (errors: LoginFieldErrors): boolean => errors.phone !== null || errors.name !== null;
