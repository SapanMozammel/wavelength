#!/usr/bin/env node
/**
 * api-probe — re-derives the Chat API's response shapes from the live server.
 *
 * The published Swagger is request-only: it documents paths, methods, and
 * request bodies, but no response bodies and no status codes. Everything in
 * `docs/api/` was produced by running this script and reading what came back,
 * so the documentation can be re-verified rather than trusted.
 *
 *   pnpm api:probe            # human-readable transcript
 *   pnpm api:probe --json     # machine-readable, for diffing against a past run
 *
 * It creates three throwaway accounts on the shared demo server and exchanges
 * a handful of messages between them. It writes nothing outside stdout.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://frontend-task-chatapp.onrender.com/api';
const ORIGIN = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'https://frontend-task-chatapp.onrender.com';
const asJson = process.argv.includes('--json');

const results = [];

const record = (label, status, body, note) => {
	results.push({ label, status, body, note });
	if (asJson) return;
	const flag = note ? `  ⚠ ${note}` : '';
	console.log(`\n── ${label}  [HTTP ${status}]${flag}`);
	console.log(typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body, null, 1).slice(0, 900));
};

const call = async (label, path, { method = 'GET', body, token, note } = {}) => {
	const headers = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const raw = await response.text();
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		parsed = raw;
	}
	record(label, response.status, parsed, note);
	return parsed;
};

const stamp = Date.now().toString().slice(-8);
const phone = (n) => `+1999${stamp}${n}`;

const main = async () => {
	if (!asJson) console.log(`Probing ${BASE}\nThrowaway accounts suffixed ${stamp}\n`);

	// The demo server is on a free tier and cold-starts; warm it first.
	await fetch(`${ORIGIN}/health`).catch(() => {});

	const a = await call('POST /auth/login (new number → registers)', '/auth/login', { method: 'POST', body: { phone: phone(1), name: `Probe A ${stamp}` } });
	const b = await call('POST /auth/login (second account)', '/auth/login', { method: 'POST', body: { phone: phone(2), name: `Probe B ${stamp}` } });
	const c = await call('POST /auth/login (third, for the group)', '/auth/login', { method: 'POST', body: { phone: phone(3), name: `Probe C ${stamp}` } });

	const tokenA = a.token;
	const tokenB = b.token;

	await call('GET /auth/me', '/auth/me', { token: tokenA });
	await call('GET /auth/me (no token)', '/auth/me', { note: '400, not 401 — inconsistent with the invalid-token case' });
	await call('GET /auth/me (bad token)', '/auth/me', { token: 'garbage.token.here', note: '401 here, 400 above' });

	await call('GET /users/search?q=<name>', `/users/search?q=Probe+${stamp}`, { token: tokenA });
	await call('GET /users/search?q=%2B1 (leading +)', '/users/search?q=%2B1', { token: tokenA, note: '500 — q is interpolated into a Mongo $regex unescaped' });
	await call('GET /users/search (q omitted)', '/users/search', { token: tokenA, note: 'q is documented required, yet this dumps every user' });

	await call('GET /conversations (empty)', '/conversations', { token: tokenA, note: 'envelope is { data: [...] } here but bare elsewhere' });

	const conversation = await call('POST /conversations (direct)', '/conversations', {
		method: 'POST',
		token: tokenA,
		body: { userId: b.user._id },
		note: '200 not 201; participants are id strings and there is no `type`',
	});
	await call('POST /conversations (repeat — idempotent)', '/conversations', { method: 'POST', token: tokenA, body: { userId: b.user._id } });
	await call('POST /conversations (own id)', '/conversations', { method: 'POST', token: tokenA, body: { userId: a.user._id }, note: 'returns an unrelated conversation instead of erroring' });

	await call('POST /messages', '/messages', { method: 'POST', token: tokenA, body: { conversationId: conversation._id, text: 'probe message' } });
	await call('POST /messages (empty text)', '/messages', { method: 'POST', token: tokenA, body: { conversationId: conversation._id, text: '' }, note: 'accepted with 200 — no server-side validation' });
	await call('POST /messages (whitespace)', '/messages', { method: 'POST', token: tokenA, body: { conversationId: conversation._id, text: '   ' }, note: 'also accepted' });

	const page = await call('GET /conversations/:id/messages', `/conversations/${conversation._id}/messages?limit=2`, { token: tokenA, note: 'newest-first order' });
	const cursor = page.messages?.[0]?._id;
	if (cursor) {
		await call('GET …/messages?before=<cursor>', `/conversations/${conversation._id}/messages?limit=5&before=${cursor}`, { token: tokenA, note: 'cursor is INCLUSIVE — the cursor message repeats' });
	}
	await call('GET …/messages (malformed id)', '/conversations/not-a-real-id/messages', { token: tokenA, note: '500 leaking a raw Mongoose CastError; should be 400' });

	const group = await call('POST /conversations/group', '/conversations/group', {
		method: 'POST',
		token: tokenA,
		body: { name: `Probe Crew ${stamp}`, participantIds: [b.user._id, c.user._id] },
		note: '201 here, with populated participants — unlike the direct POST above',
	});
	await call('POST /conversations/group (2 members)', '/conversations/group', { method: 'POST', token: tokenA, body: { name: 'Too small', participantIds: [b.user._id] }, note: 'strict validation here, none on message text' });
	await call('POST /conversations/group (blank name)', '/conversations/group', { method: 'POST', token: tokenA, body: { name: '', participantIds: [b.user._id, c.user._id] } });

	await call('PATCH /conversations/:id (admin)', `/conversations/${group._id}`, { method: 'PATCH', token: tokenA, body: { name: `Renamed ${stamp}` } });
	await call('PATCH /conversations/:id (non-admin)', `/conversations/${group._id}`, { method: 'PATCH', token: tokenB, body: { name: 'Hijacked' }, note: '403 — authorization is enforced correctly' });
	await call('POST /conversations/:id/admins', `/conversations/${group._id}/admins`, { method: 'POST', token: tokenA, body: { userId: c.user._id } });
	await call('DELETE /conversations/:id/participants/:userId', `/conversations/${group._id}/participants/${c.user._id}`, { method: 'DELETE', token: tokenA });

	await call('GET /conversations (populated)', '/conversations', { token: tokenA, note: 'direct rows carry `participant`, group rows carry `participants` — a union in all but name' });

	// /health is mounted at the origin root, NOT under the /api base the spec declares.
	const rootHealth = await fetch(`${ORIGIN}/health`);
	record('GET /health (origin root)', rootHealth.status, await rootHealth.json(), 'the spec places this under /api, where it 404s');
	const apiHealth = await fetch(`${BASE}/health`);
	record('GET /api/health (as documented)', apiHealth.status, await apiHealth.text(), 'documented location — does not exist');

	if (asJson) console.log(JSON.stringify(results, null, 2));
	else console.log('\n\nDone. Findings are catalogued in docs/api/README.md § Quirks.');
};

main().catch((error) => {
	console.error('Probe failed:', error);
	process.exit(1);
});
