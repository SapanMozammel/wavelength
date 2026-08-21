/**
 * Bypass block for keyboard and screen-reader users (WCAG 2.4.1).
 *
 * Hidden until focused, then it becomes the first visible thing on the page.
 * It matters most on `/chat`, where the sidebar puts a long list of
 * conversations between the top of the document and the message panel.
 */
const SkipLink = () => (
	<a href='#main' className='bg-signal-600 focus:ring-signal-500 sr-only rounded-full px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-60'>
		Skip to main content
	</a>
);

export default SkipLink;
