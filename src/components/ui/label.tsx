'use client';

import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import { memo, type ComponentPropsWithoutRef } from 'react';

type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

const Label = memo(({ className, ...rest }: LabelProps) => <LabelPrimitive.Root className={cn('text-ink-muted dark:text-ink-muted-dark text-xs font-medium', className)} {...rest} />);

Label.displayName = 'Label';

export default Label;
