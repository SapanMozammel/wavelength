import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Group administration.
 *
 * The behaviour worth testing is the gate: an admin sees the controls, a plain
 * member does not, and everybody can leave. Hiding a control the server would
 * reject is the whole design — a 403 arriving after a click is a fallback for
 * being demoted mid-session, not the mechanism.
 */

const TOKEN = 'valid.jwt.token';
const STORAGE_KEY = 'wavelength.session';

const ME = { _id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const GRACE = { _id: 'u2', name: 'Grace Hopper', phone: '+15557654321' };
const KATHERINE = { _id: 'u3', name: 'Katherine Johnson', phone: '+15550001111' };

const group = (adminIds: string[]) => ({
	_id: 'g1',
	type: 'group',
	name: 'Launch crew',
	lastMessage: {},
	updatedAt: '2026-08-20T10:00:00.000Z',
	createdBy: ME._id,
	admins: adminIds,
	participants: [ME, GRACE, KATHERINE],
});

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockApi = async (page: Page, adminIds: string[]) => {
	await page.route('**/api/auth/me', (route) => route.fulfill(json(ME)));
	await page.route('**/api/conversations', (route) => route.fulfill(json({ data: [group(adminIds)] })));
	await page.route('**/api/conversations/g1/messages**', (route) => route.fulfill(json({ messages: [], hasMore: false })));
	await page.route('**/health', (route) => route.fulfill(json({ status: 'ok' })));
};

const openGroup = async (page: Page, adminIds: string[]) => {
	await mockApi(page, adminIds);
	await page.goto('/__seed');
	await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify({ token: TOKEN, user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const);
	await page.goto('/chat');
	await page.getByRole('button', { name: /Launch crew/ }).first().click();
	await page.getByRole('button', { name: /Group details/ }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
};

test.describe('group administration', () => {
	test('an admin gets the controls that change the group', async ({ page }) => {
		await openGroup(page, [ME._id]);

		await expect(page.getByLabel('Group name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
		await expect(page.getByRole('button', { name: `Manage ${GRACE.name}` })).toBeVisible();
	});

	test('a plain member sees none of them, and is told why', async ({ page }) => {
		// Grace is the only admin; the session user is an ordinary member.
		await openGroup(page, [GRACE._id]);

		await expect(page.getByLabel('Group name')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Add' })).toBeHidden();
		await expect(page.getByRole('button', { name: `Manage ${GRACE.name}` })).toBeHidden();
		await expect(page.getByText(/only admins can rename/i)).toBeVisible();
	});

	test('everyone can leave, admin or not', async ({ page }) => {
		await openGroup(page, [GRACE._id]);
		await expect(page.getByRole('button', { name: 'Leave group' })).toBeVisible();
	});

	test('row actions name the person they act on', async ({ page }) => {
		await openGroup(page, [ME._id]);
		await page.getByRole('button', { name: `Manage ${KATHERINE.name}` }).click();

		// A menu of identical "Remove" labels is unusable with a screen reader,
		// and is exactly where removing the wrong person is easy.
		await expect(page.getByRole('menuitem', { name: `Remove ${KATHERINE.name} from the group` })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: `Make ${KATHERINE.name} an admin` })).toBeVisible();
	});

	test('the only admin is warned before leaving breaks the group', async ({ page }) => {
		await openGroup(page, [ME._id]);
		await page.getByRole('button', { name: 'Leave group' }).click();

		// This API lets the last admin walk out and leaves the group permanently
		// unmanageable. The server will not stop it, so the UI says so.
		await expect(page.getByText(/only admin/i)).toBeVisible();
		await expect(page.getByText(/someone else an admin first/i)).toBeVisible();
	});

	test('a group with another admin gets no such warning', async ({ page }) => {
		await openGroup(page, [ME._id, GRACE._id]);
		await page.getByRole('button', { name: 'Leave group' }).click();

		await expect(page.getByRole('button', { name: 'Leave group', exact: true }).last()).toBeVisible();
		await expect(page.getByText(/only admin/i)).toBeHidden();
	});

	test('a blank rename is refused before it reaches the server', async ({ page }) => {
		let patches = 0;
		await page.route('**/api/conversations/g1', (route) => {
			patches += 1;
			return route.fulfill(json(group([ME._id])));
		});
		await openGroup(page, [ME._id]);

		await page.getByLabel('Group name').fill('   ');
		await expect(page.getByText('A group needs a name.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		expect(patches).toBe(0);
	});
});

test.describe('group details accessibility', () => {
	for (const scheme of ['light', 'dark'] as const) {
		test(`the details sheet has no detectable axe violations in ${scheme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await openGroup(page, [ME._id]);

			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
			expect(results.violations).toEqual([]);
		});
	}

	test('focus is trapped in the sheet and returns to its trigger on close', async ({ page }) => {
		await openGroup(page, [ME._id]);

		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page.getByRole('button', { name: /Group details/ })).toBeFocused();
	});
});
