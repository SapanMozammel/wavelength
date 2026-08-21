import ClaimBlock from '@/components/layout/landing/claims/claim-block';
import FigureCredentials from '@/components/layout/landing/claims/figure-credentials';
import FigureLatency from '@/components/layout/landing/claims/figure-latency';
import FigureRoster from '@/components/layout/landing/claims/figure-roster';
import SectionHeading from '@/components/layout/landing/section-heading';

/**
 * Three claims, each one backed by something that exists. There are three
 * rather than six because a fourth would have had to be padding, and a page
 * arguing that this product does less on purpose cannot afford filler.
 */
const Claims = () => (
	<section id='claims' className='border-border-subtle dark:border-border-subtle-dark border-t'>
		<div className='mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28'>
			<SectionHeading index='03' tag='What it does' title='Three claims, each one something that was built.'>
				<p>Nothing below is aspirational. Every one of these is a behaviour you can go and check in the app — which is also why there are three of them and not six.</p>
			</SectionHeading>

			<div className='mt-16 space-y-20 sm:mt-20 sm:space-y-28'>
				<ClaimBlock kicker='Identity' title='No accounts. One number, one name.' figure={<FigureCredentials />}>
					<p>
						<code className='text-ink dark:text-ink-dark font-mono text-[0.875em]'>POST /auth/login</code> takes a phone number and a display name. If the number is new it becomes an account; if it is known,
						you are logged into it. That is the whole identity system, and the client does not invent a step the server never asked for.
					</p>
					<p>
						The one piece of care it does take is invisible: every number is normalised to E.164 before it leaves the browser, because the search endpoint substring-matches the stored string. A number saved
						one way and looked up another is an account nobody can find — and neither request fails.
					</p>
				</ClaimBlock>

				<ClaimBlock kicker='Transport' title='Live, not polled.' figure={<FigureLatency />} reversed>
					<p>Messages arrive over a socket, in the moment they are sent. There is no interval to wait out, no refresh button, and no request that comes back empty nine times out of ten.</p>
					<p>
						One wrinkle is worth naming, because it shaped the code: the server does not echo your own message back to you, only to everyone else. So the message you just sent is drawn locally the instant you
						press send and reconciled when the server confirms it. Local echo here is a correctness requirement, not a flourish.
					</p>
				</ClaimBlock>

				<ClaimBlock kicker='Groups' title='Groups that behave.' figure={<FigureRoster />}>
					<p>Create a group, add people by number, rename it, leave it, hand someone else admin. Each of those is a real endpoint, and each of them changes what everyone else sees the moment it happens.</p>
					<p>The conversation list re-sorts as messages land, so the thread you are actually in is the one at the top — without you having gone looking for it.</p>
				</ClaimBlock>
			</div>
		</div>
	</section>
);

export default Claims;
