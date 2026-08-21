import { ImageResponse } from 'next/og';

export const alt = "Wavelength — a number, a name, and you're on the air";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The one place in this project where colours are written as hex.
 *
 * `ImageResponse` renders outside the CSS pipeline — there is no stylesheet, no
 * `@theme`, and no custom properties to read — so the tokens have to be
 * restated as literals. These are the exact sRGB values of the `oklch()` tokens
 * in `src/styles/global.scss`; if a token there moves, move it here too. The
 * root layout already does the same thing for `viewport.themeColor`, for the
 * same reason.
 */
const TOKEN = {
	canvas: '#0f0f15',
	surface: '#17171f',
	border: '#2f2f39',
	ink: '#eeeef2',
	inkMuted: '#a0a1a9',
	signal: '#7f67ff',
	signalSoft: '#958aff',
	pulse: '#00e0e0',
};

/** The still rings from the hero, at OG scale. */
const RINGS = [260, 400, 540, 700];

/** Where the rings emanate from, mirroring the hero's off-centre placement. */
const ORIGIN = { x: 985, y: 300 };

/**
 * The social card: the wordmark, the headline, and the signal-ring motif, so a
 * shared link looks like the page it opens rather than a generic screenshot.
 * Generated at build time — nothing here reads a request.
 */
const OpengraphImage = () =>
	new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				position: 'relative',
				padding: 76,
				backgroundColor: TOKEN.canvas,
				backgroundImage: `radial-gradient(900px 600px at 50% -20%, ${TOKEN.signal}33, transparent 70%)`,
				fontFamily: 'sans-serif',
			}}
		>
			{RINGS.map((diameter) => (
				<div
					key={diameter}
					style={{
						position: 'absolute',
						display: 'flex',
						left: ORIGIN.x - diameter / 2,
						top: ORIGIN.y - diameter / 2,
						width: diameter,
						height: diameter,
						borderRadius: diameter,
						border: `1px solid ${TOKEN.signal}2e`,
					}}
				/>
			))}
			<div style={{ position: 'absolute', display: 'flex', left: ORIGIN.x - 10, top: ORIGIN.y - 10, width: 20, height: 20, borderRadius: 20, backgroundColor: TOKEN.pulse }} />

			<div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
				<div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 34 }}>
					<div style={{ display: 'flex', width: 6, height: 14, borderRadius: 6, backgroundColor: TOKEN.signal }} />
					<div style={{ display: 'flex', width: 6, height: 30, borderRadius: 6, backgroundColor: TOKEN.signalSoft }} />
					<div style={{ display: 'flex', width: 6, height: 20, borderRadius: 6, backgroundColor: TOKEN.signal }} />
					<div style={{ display: 'flex', width: 22, height: 6, borderRadius: 6, backgroundColor: TOKEN.pulse }} />
				</div>
				<div style={{ fontSize: 30, fontWeight: 600, color: TOKEN.ink, letterSpacing: -0.5 }}>Wavelength</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
				<div style={{ fontSize: 20, color: TOKEN.pulse, letterSpacing: 6, textTransform: 'uppercase', marginBottom: 26 }}>Real-time chat · no accounts</div>
				<div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 600, color: TOKEN.ink, letterSpacing: -2 }}>A number, a name, and you're on the air.</div>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 20, borderTop: `1px solid ${TOKEN.border}`, paddingTop: 26 }}>
				<div style={{ display: 'flex', backgroundColor: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: '10px 18px', fontSize: 22, color: TOKEN.inkMuted }}>+1 555 123 0134</div>
				<div style={{ display: 'flex', backgroundColor: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: '10px 18px', fontSize: 22, color: TOKEN.inkMuted }}>Priya</div>
				<div style={{ display: 'flex', backgroundColor: TOKEN.signal, borderRadius: 12, padding: '10px 22px', fontSize: 22, color: TOKEN.canvas, fontWeight: 600 }}>Go on the air</div>
			</div>
		</div>,
		size
	);

export default OpengraphImage;
