import { cn } from '@/lib/utils';

/**
 * Fixed bar heights, written out as literal utility strings so nothing builds a
 * class name at runtime and Tailwind's scanner can see every one of them. The
 * silhouette is deliberately irregular — an even comb reads as a chart axis,
 * this reads as a signal.
 */
const BARS = [
	'h-2',
	'h-4',
	'h-3',
	'h-7',
	'h-5',
	'h-10',
	'h-4',
	'h-8',
	'h-14',
	'h-6',
	'h-11',
	'h-16',
	'h-9',
	'h-20',
	'h-12',
	'h-7',
	'h-16',
	'h-10',
	'h-5',
	'h-13',
	'h-8',
	'h-4',
	'h-9',
	'h-6',
	'h-3',
	'h-7',
	'h-4',
	'h-2',
	'h-5',
	'h-3',
	'h-2',
	'h-1',
];

type SpectrumRuleProps = {
	className?: string;
};

/**
 * The page's recurring motif: a spectrum trace standing on a hairline, used
 * wherever a plain divider would otherwise go. Purely decorative, so it is
 * hidden from assistive technology and carries no motion.
 */
const SpectrumRule = ({ className }: SpectrumRuleProps) => (
	<div aria-hidden='true' className={cn('relative', className)}>
		<div className='flex h-20 items-end justify-between'>
			{BARS.map((height, index) => (
				<span key={`${height}-${index.toString()}`} className={cn('bg-signal-500/30 dark:bg-signal-400/30 w-1 rounded-full', height)} />
			))}
		</div>
		<div className='bg-border-subtle dark:bg-border-subtle-dark h-px w-full' />
	</div>
);

export default SpectrumRule;
