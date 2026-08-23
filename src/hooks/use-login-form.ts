import { useMountEffect } from '@/hooks/use-mount-effect';
import { login } from '@/lib/api';
import { ApiError, userFacingMessage } from '@/lib/api/errors';
import { isLoginField, validateLoginFields, type LoginField, type LoginFieldErrors } from '@/lib/auth/schema';
import { readPersistedSession } from '@/lib/auth/storage';
import { formatPhoneAsYouType, normalizePhone } from '@/lib/utils/phone';
import { useAppDispatch } from '@/store/hooks';
import { sessionEstablished } from '@/store/slices/session-slice';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type FormEvent } from 'react';

/**
 * All of `/login`'s behaviour, kept out of the markup.
 *
 * Three things here are deliberate:
 *
 * 1. **Field values are local state, never Redux.** The store would re-render
 *    every subscriber on each keystroke and gain nothing; the only thing worth
 *    sharing is the session that a successful submit produces.
 * 2. **Submitting is an event handler end to end** — validate, normalize,
 *    request, dispatch, navigate. There is no flag relayed into an effect, so
 *    there is no window in which the form is "about to" submit.
 * 3. **What is typed and what is sent are different strings.** The field shows
 *    `formatPhoneAsYouType` output because a grouped number is proofreadable;
 *    the request carries `normalizePhone`'s E.164 because `/users/search`
 *    substring-matches the stored string, so a number saved in display format
 *    is an account nobody can find.
 */

/** A remembered identity from a previous visit — used only to pre-fill. */
type RememberedIdentity = {
	phone: string;
	name: string;
};

type TouchedFields = Record<LoginField, boolean>;

const NO_ERRORS: LoginFieldErrors = { phone: null, name: null };
const UNTOUCHED: TouchedFields = { phone: false, name: false };

export type LoginFormState = {
	phone: string;
	name: string;
	/** The error to render under each field right now, or `null` to render none. */
	errors: LoginFieldErrors;
	/** A whole-form failure — a rejected request, or a field the form cannot blame. */
	formError: string | null;
	isSubmitting: boolean;
	/**
	 * True when submitting would rename an existing account. See quirk 14: the
	 * API has no profile endpoint, so login *is* the rename mechanism.
	 */
	isRenaming: boolean;
	onPhoneChange: (value: string) => void;
	onNameChange: (value: string) => void;
	onBlur: (field: LoginField) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const useLoginForm = (): LoginFormState => {
	const dispatch = useAppDispatch();
	const router = useRouter();

	const [phone, setPhone] = useState('');
	const [name, setName] = useState('');
	const [touched, setTouched] = useState<TouchedFields>(UNTOUCHED);
	const [submitAttempted, setSubmitAttempted] = useState(false);
	const [serverErrors, setServerErrors] = useState<LoginFieldErrors>(NO_ERRORS);
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [remembered, setRemembered] = useState<RememberedIdentity | null>(null);

	/**
	 * Pre-fill from the last session on mount rather than at module scope —
	 * `localStorage` does not exist during the server render, and seeding the
	 * initial state from it would make the first client render disagree with
	 * the server's markup.
	 */
	useMountEffect(() => {
		const persisted = readPersistedSession();
		if (persisted === null) {
			return;
		}
		setRemembered({ phone: persisted.user.phone, name: persisted.user.name });
		setPhone(formatPhoneAsYouType(persisted.user.phone));
		setName(persisted.user.name);
	});

	const clientErrors = useMemo(() => validateLoginFields({ phone, name }), [phone, name]);

	/**
	 * A field shows its error once the user has left it or tried to submit —
	 * never while they are still typing the first character of an empty form.
	 * A server error outranks a client one: it is newer, and it is the only
	 * kind the client could not have predicted.
	 */
	const errors = useMemo<LoginFieldErrors>(
		() => ({
			phone: serverErrors.phone ?? (touched.phone || submitAttempted ? clientErrors.phone : null),
			name: serverErrors.name ?? (touched.name || submitAttempted ? clientErrors.name : null),
		}),
		[serverErrors, touched, submitAttempted, clientErrors]
	);

	/**
	 * Only a *different* name on the *same* account is a rename. A different
	 * phone number is a different account, so the warning would be a lie.
	 */
	const isRenaming = useMemo(() => {
		if (remembered === null || remembered.name === '') {
			return false;
		}
		const trimmed = name.trim();
		return trimmed !== '' && trimmed !== remembered.name && normalizePhone(phone) === remembered.phone;
	}, [remembered, name, phone]);

	const onPhoneChange = useCallback((value: string) => {
		// A fresh formatter per keystroke — `AsYouType` is stateful, and a shared
		// instance would carry digits across edits.
		setPhone(formatPhoneAsYouType(value));
		setServerErrors((current) => (current.phone === null ? current : { ...current, phone: null }));
	}, []);

	const onNameChange = useCallback((value: string) => {
		setName(value);
		setServerErrors((current) => (current.name === null ? current : { ...current, name: null }));
	}, []);

	const onBlur = useCallback((field: LoginField) => {
		setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
	}, []);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (isSubmitting) {
				return;
			}

			setSubmitAttempted(true);
			setFormError(null);
			setServerErrors(NO_ERRORS);

			const nextErrors = validateLoginFields({ phone, name });
			const normalizedPhone = normalizePhone(phone);
			if (nextErrors.phone !== null || nextErrors.name !== null || normalizedPhone === null) {
				return;
			}

			setIsSubmitting(true);
			void (async () => {
				try {
					const session = await login(normalizedPhone, name.trim());
					dispatch(sessionEstablished(session));
					// `replace`, not `push` — the back button should not walk a
					// signed-in user into a login screen they already cleared.
					router.replace('/chat');
				} catch (error) {
					setIsSubmitting(false);
					if (!(error instanceof ApiError)) {
						setFormError('Something went wrong. Please try again.');
						return;
					}
					const blamed = error.fieldErrors.filter((detail) => isLoginField(detail.path));
					if (blamed.length > 0) {
						setServerErrors({
							phone: blamed.find((detail) => detail.path === 'phone')?.message ?? null,
							name: blamed.find((detail) => detail.path === 'name')?.message ?? null,
						});
						return;
					}
					setFormError(userFacingMessage(error));
				}
			})();
		},
		[dispatch, router, phone, name, isSubmitting]
	);

	return { phone, name, errors, formError, isSubmitting, isRenaming, onPhoneChange, onNameChange, onBlur, onSubmit };
};
