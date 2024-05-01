import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			width: {
				50: '12.5rem'
			},
			colors: {
				gray: {
					20: '#fdfdfe'
				}
			},
			gridTemplateAreas: {
				layout: ['sidebar main', 'sidebar footer'],
				card: ['labels labels', 'image content']
			},
			gridTemplateColumns: {
				'layout-md': '16rem 1fr',
				layout: '12.5rem 1fr',
				cards: 'repeat(auto-fill,minmax(15rem,1fr))',
				card: 'auto 1fr'
			},
			gridTemplateRows: {
				layout: '1fr auto',
				card: 'auto 1fr'
			}
		}
	},
	plugins: [require('@savvywombat/tailwindcss-grid-areas')]
};
