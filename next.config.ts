import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	typescript: {
		ignoreBuildErrors: false,
	},

	experimental: {
		optimizePackageImports: ['@tabler/icons-react', 'framer-motion'],
	},

	onDemandEntries: {
		maxInactiveAge: 25 * 1000,
		pagesBufferLength: 2,
	},

	compress: true,

	images: {
		qualities: [75, 85, 90],
		formats: ['image/webp', 'image/avif'],
		minimumCacheTTL: 31536000,
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
		unoptimized: process.env.NODE_ENV === 'development',
	},

	async headers() {
		const isProd = process.env.NODE_ENV === 'production';
		return [
			{
				source: '/(.*)',
				headers: [
					...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
					{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
				],
			},
		];
	},
};

export default nextConfig;
