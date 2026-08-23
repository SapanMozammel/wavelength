'use client';

import { cn } from '@/lib/utils';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { IconCheck } from '@tabler/icons-react';
import { memo, type ComponentPropsWithoutRef } from 'react';

type CheckboxProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

const Checkbox = memo(({ className, ...rest }: CheckboxProps) => (
	<CheckboxPrimitive.Root
		className={cn(
			'border-border-subtle dark:border-border-subtle-dark data-[state=checked]:bg-signal-600 data-[state=checked]:border-signal-600 dark:data-[state=checked]:bg-signal-500 dark:data-[state=checked]:border-signal-500 grid size-5 shrink-0 place-items-center rounded-[0.3rem] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
		{...rest}
	>
		<CheckboxPrimitive.Indicator className='dark:text-canvas-dark text-white'>
			<IconCheck aria-hidden='true' className='size-3.5' stroke={3} />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
));

Checkbox.displayName = 'Checkbox';

export default Checkbox;
