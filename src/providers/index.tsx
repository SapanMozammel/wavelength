'use client';

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
			{children}
		</ThemeProvider>
	</ReduxProvider>
));

Providers.displayName = 'Providers';

export default Providers;
