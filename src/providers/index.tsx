'use client';

import Toaster from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { store } from '@/store';
import { ThemeProvider } from 'next-themes';
import { memo, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';

type ProvidersProps = {
	children: ReactNode;
};

const Providers = memo(({ children }: ProvidersProps) => (
	<ReduxProvider store={store}>
		<ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
			<TooltipProvider delayDuration={300}>
				{children}
				<Toaster />
			</TooltipProvider>
		</ThemeProvider>
	</ReduxProvider>
));

Providers.displayName = 'Providers';

export default Providers;
