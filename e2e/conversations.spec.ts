import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The conversation directory, end to end: find someone, start a chat with
 * them, and build a group.
 *
 * Every call to the chat API is intercepted with the real wire shapes — `_id`,
 * ISO timestamps, `lastMessage: {}` for an empty conversation, and the stub
 * that `POST /conversations` actually returns. Mocking is not a shortcut here:
 * the upstream server is shared with every other candidate, so a live search
 * would surface strangers' accounts and a live create would leave rows behind.
 *
 * The three faults this screen sits on are all visible below:
 *
 * - searching a `+`-prefixed number must not reach the endpoint verbatim, or
 *   the unescaped `$regex` answers 500;
 * - you are in your own search results, and starting a chat with your own id
 *   returns a stranger's conversation with a 200 — so you are filtered out and
 *   told why;
 * - `POST /conversations` returns no `type` and no resolved participant, so the
 *   new row is reconstituted from the peer already in hand rather than by
 *   refetching the list.
 */

const TOKEN = 'valid.jwt.token';
const STORAGE_KEY = 'wavelength.session';

const ME = { _id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const GRACE = { _id: 'u2', name: 'Grace Hopper', phone: '+15557654321' };
const KATHERINE = { _id: 'u3', name: 'Katherine Johnson', phone: '+15550001111' };
const ALAN = { _id: 'u9', name: 'Alan Turing', phone: '+15559998888' };

const DIRECTORY = [ME, GRACE, KATHERINE, ALAN];

/** One existing direct conversation, so the list is not empty on arrival. */
const EXISTING = {
	_id: 'c1',
	type: 'direct',
	lastMessage: { text: 'Deploying now', sender: ALAN._id, createdAt: '2026-08-20T10:00:00.000Z' },
	updatedAt: '2026-08-20T10:00:00.000Z',
	participant: ALAN,
};

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * The whole surface this screen touches. Registered narrowest-last, because
 * Playwright resolves the most recently registered matching handler first.
 */
const mockChatApi = async (page: Page) => {
	await page.route('**/api/auth/me', async (route) => {
		await route.fulfill(json(ME));
	});

	await page.route('**/api/users/search**', async (route) => {
		const term = new URL(route.request().url()).searchParams.get('q') ?? '';
		// The server substring-matches name and phone, and includes the caller.
		const matches = DIRECTORY.filter((user) => user.name.toLowerCase().includes(term.toLowerCase()) || user.phone.includes(term));
		await route.fulfill(json(matches));
	});

	await page.route('**/api/conversations', async (route) => {
		if (route.request().method() === 'POST') {
			const { userId } = route.request().postDataJSON() as { userId: string };
			// Quirk 8: the create response is a stub — no `type`, no `updatedAt`,
			// participants as bare id strings.
			await route.fulfill(json({ _id: `direct-${userId}`, participants: [ME._id, userId], createdAt: '2026-08-21T09:00:00.000Z' }, 201));
			return;
		}
		await route.fulfill(json({ data: [EXISTING] }));
	});

	await page.route('**/api/conversations/group', async (route) => {
		const { name, participantIds } = route.request().postDataJSON() as { name: string; participantIds: string[] };
		const members = [ME, ...DIRECTORY.filter((user) => participantIds.includes(user._id))];
		await route.fulfill(
			json(
				{
					_id: 'group-1',
					type: 'group',
					name,
					createdBy: ME._id,
					admins: [ME._id],
					participants: members,
					createdAt: '2026-08-21T09:00:00.000Z',
					updatedAt: '2026-08-21T09:00:00.000Z',
				},
				201
			)
		);
	});
};

/** Seeds the session off a cheap route — see the note in `auth.spec.ts`. */
const seedSession = async (page: Page) => {
	await page.goto('/__seed');
	await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify({ token: TOKEN, user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const);
};

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Conversations' });
const panel = (page: Page) => page.getByRole('region', { name: 'Conversation' });
const searchField = (page: Page) => page.getByLabel('Search people by name or phone number');

/**
 * Opens `/chat` and waits until the list has actually rendered.
 *
 * The row can only exist after hydration *and* after the fetch it triggers, so
 * it is the one signal that proves the client island is live. Typing into the
 * search field before that point goes into an input React has not attached to
 * yet, and the keystrokes are lost on hydration.
 */
const gotoChat = async (page: Page) => {
	await seedSession(page);
	await page.goto('/chat');
	await expect(sidebar(page).getByRole('button', { name: new RegExp(ALAN.name) })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
	await mockChatApi(page);
});

test.describe('starting a conversation', () => {
	test('a search finds someone and one tap puts them in the list', async ({ page }) => {
		await gotoChat(page);

		await searchField(page).fill('Grace');
		const result = sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) });
		await expect(result).toBeVisible();

		await result.click();

		// The field clears, the list comes back, and the new row is there —
		// reconstituted from the create stub plus the peer, with no refetch.
		await expect(searchField(page)).toHaveValue('');
		await expect(sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) })).toBeVisible();
		await expect(panel(page).getByText(GRACE.name)).toBeVisible();
	});

	test('a phone number with a leading + searches without crashing the endpoint', async ({ page }) => {
		const terms: string[] = [];
		await page.route('**/api/users/search**', async (route) => {
			const term = new URL(route.request().url()).searchParams.get('q') ?? '';
			terms.push(term);
			await route.fulfill(json(DIRECTORY.filter((user) => user.phone.includes(term))));
		});

		await gotoChat(page);
		await searchField(page).fill('+15557654321');

		await expect(sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) })).toBeVisible();
		// The `+` is stripped before it reaches the unescaped `$regex`.
		expect(terms.every((term) => !term.includes('+'))).toBe(true);
	});

	test('searching your own number says so instead of returning nothing', async ({ page }) => {
		await gotoChat(page);

		await searchField(page).fill(ME.phone);

		await expect(sidebar(page).getByText("That's you.")).toBeVisible();
		await expect(sidebar(page).getByRole('button', { name: new RegExp(ME.name) })).toHaveCount(0);
	});

	test('a search with no matches names the problem rather than going blank', async ({ page }) => {
		await gotoChat(page);

		await searchField(page).fill('nobody at all');

		await expect(sidebar(page).getByText('No one found')).toBeVisible();
	});
});

test.describe('group conversations', () => {
	const openDialog = async (page: Page) => {
		await page.getByRole('button', { name: 'New group' }).click();
		await expect(page.getByRole('dialog', { name: 'New group' })).toBeVisible();
	};

	const addMember = async (page: Page, name: string) => {
		await page.getByLabel('Add people').fill(name);
		await page.getByRole('dialog').getByLabel(new RegExp(name)).check();
	};

	test('the create button refuses until there is a name and two other people', async ({ page }) => {
		await gotoChat(page);
		await openDialog(page);

		const create = page.getByRole('button', { name: 'Create group' });
		await expect(create).toBeDisabled();
		await expect(page.getByText('Give the group a name.')).toBeVisible();

		await page.getByLabel('Group name').fill('Launch crew');
		await addMember(page, GRACE.name);

		// One other person is not a group — the server would answer 400.
		await expect(create).toBeDisabled();
		await expect(page.getByText('Pick at least 2 people. A group needs three members, including you.')).toBeVisible();
	});

	test('a group of three lands in the list with the right member count', async ({ page }) => {
		await gotoChat(page);
		await openDialog(page);

		await page.getByLabel('Group name').fill('Launch crew');
		await addMember(page, GRACE.name);
		await addMember(page, KATHERINE.name);

		const create = page.getByRole('button', { name: 'Create group' });
		await expect(create).toBeEnabled();
		await create.click();

		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(sidebar(page).getByRole('button', { name: /Launch crew/ })).toBeVisible();
		// Three, counting the creator the server adds back.
		await expect(panel(page).getByText('3 members')).toBeVisible();
	});

	test('a chosen member can be taken back off the list before creating', async ({ page }) => {
		await gotoChat(page);
		await openDialog(page);

		await page.getByLabel('Group name').fill('Launch crew');
		await addMember(page, GRACE.name);
		await addMember(page, KATHERINE.name);
		await expect(page.getByRole('button', { name: 'Create group' })).toBeEnabled();

		await page.getByRole('button', { name: `Remove ${KATHERINE.name}` }).click();

		await expect(page.getByRole('button', { name: 'Create group' })).toBeDisabled();
	});
});

test.describe('narrow viewports', () => {
	test('the list is the page, and selecting a conversation moves to the panel', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await gotoChat(page);

		await expect(sidebar(page)).toBeVisible();
		await expect(panel(page)).toBeHidden();

		await sidebar(page).getByRole('button', { name: new RegExp(ALAN.name) }).click();

		await expect(panel(page)).toBeVisible();
		await expect(sidebar(page)).toBeHidden();

		await page.getByRole('button', { name: 'Back to conversations' }).click();
		await expect(sidebar(page)).toBeVisible();
	});
});

test.describe('accessibility', () => {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`the chat screen has no detectable axe violations in ${colorScheme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await gotoChat(page);

			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
			expect(results.violations).toEqual([]);
		});
	}

	test('search results are reachable and startable from the keyboard alone', async ({ page }) => {
		await gotoChat(page);

		await searchField(page).focus();
		await page.keyboard.type('Grace');
		await expect(sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) })).toBeVisible();

		// Down from the field lands on the first result; Enter starts the chat.
		await page.keyboard.press('ArrowDown');
		await expect(sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) })).toBeFocused();
		await page.keyboard.press('Enter');

		await expect(searchField(page)).toHaveValue('');
		await expect(sidebar(page).getByRole('button', { name: new RegExp(GRACE.name) })).toBeVisible();
	});
});
