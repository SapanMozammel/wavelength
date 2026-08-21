'use client';

import { cn } from '@/lib/utils';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { memo, type ComponentPropsWithoutRef } from 'react';

type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;

const Separator = memo(({ className, orientation = 'horizontal', decorative = true, ...rest }: SeparatorProps) => (
	<SeparatorPrimitive.Root
		orientation={orientation}
		decorative={decorative}
		className={cn('bg-border-subtle dark:bg-border-subtle-dark shrink-0', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
		{...rest}
	/>
));

Separator.displayName = 'Separator';

export default Separator;
