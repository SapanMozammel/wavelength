import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
		conditions: ['browser'],
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.tsx'],
		include: ['tests/**/*.test.{ts,tsx}'],
		css: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.{ts,tsx}'],
			exclude: ['src/types/**'],
		},
	},
});
