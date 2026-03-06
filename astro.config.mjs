import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import remote from './src/integrations/remote';

// https://astro.build/config
export default defineConfig({
	site: 'https://touhou.group',
	output: 'static',
	redirects: {
		'/school': '/学校东方群',
		'/regional': '/地区性东方群',
		'/functional': '/功能性公开群',
		'/events': '/活动官方群',
		'/organizations': '/组织实体官方群',
		'/online': '/网络区域社群'
	},
	integrations: [
		remote({
			source: {
				revisionApi:
					'https://thwiki.cc/api.php?action=query&format=json&prop=revisions&list=&titles=%E4%B8%9C%E6%96%B9%E7%9B%B8%E5%85%B3QQ%E7%BE%A4%E7%BB%84%E5%88%97%E8%A1%A8&formatversion=2&rvprop=timestamp%7Cids',
				parseApi:
					'https://thwiki.cc/api.php?action=parse&format=json&page=%E4%B8%9C%E6%96%B9%E7%9B%B8%E5%85%B3QQ%E7%BE%A4%E7%BB%84%E5%88%97%E8%A1%A8&prop=text&wrapoutputclass=&disablelimitreport=1&disableeditsection=1&disabletoc=1&formatversion=2',
				imageDomains: ['upload.thbwiki.cc']
			}
		}),
		tailwind(),
		sitemap()
	]
});
