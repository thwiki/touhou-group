import type { z } from 'zod';
import path from 'path';
import GithubSlugger from 'github-slugger';
import { JSDOM } from 'jsdom';
import {
	SourceParseSchema,
	ListSchema,
	GroupSchema,
	SourceRevisionSchema,
	InfoSchema
} from './schema';

type ConvertDataConfig = {
	sourceRevisionApi: string;
	sourceParseApi: string;
	imageDomains: string[];
	imageExtensions: string[];
};

function extractImageAndLink(
	element: HTMLElement,
	{ sourceParseApi, imageDomains, imageExtensions }: ConvertDataConfig
): {
	image?: string;
	link?: string;
} {
	try {
		const img = element.querySelector('img');
		if (img == null) {
			return {};
		}

		const image = img.src;
		const url = new URL(image, sourceParseApi);

		if (
			url.protocol !== 'https:' ||
			!imageDomains.includes(url.hostname) ||
			!imageExtensions.includes(path.extname(url.pathname))
		) {
			return {};
		}

		const a = img.closest('a');
		if (a == null) {
			return { image };
		}

		let link = '';
		try {
			link = new URL(a.href, sourceParseApi).href;
		} catch (_: unknown) {
			return { image };
		}

		return { image, link };
	} catch (_: unknown) {
		return {};
	}
}

export async function convertData(config: ConvertDataConfig) {
	const { sourceRevisionApi, sourceParseApi } = config;
	const buildDate = new Date();

	const rivisionData = SourceRevisionSchema.parse(await (await fetch(sourceRevisionApi)).json());

	const parseData = SourceParseSchema.parse(await (await fetch(sourceParseApi)).json());

	const { title, revisions } = rivisionData.query.pages[0];
	const { revid, timestamp } = revisions[0];
	const { text } = parseData.parse;

	const dom = new JSDOM(text, { contentType: 'text/html' });
	const { document } = dom.window;
	const { body } = document;

	const lists: z.infer<typeof ListSchema>[] = [];
	let list: (typeof lists)[number] | null = null;

	for (const childNode of body.children) {
		const { tagName } = childNode;
		if (tagName === 'TABLE') {
			if (list == null) {
				continue;
			}
			const section = list.sections[list.sections.length - 1];
			section.groups = Array.from(childNode.querySelectorAll<HTMLTableRowElement>('tbody>tr')).map(
				(row) => {
					const [memoCell, nameCell, idCell, ...labelCells] = Array.from(
						row.querySelectorAll('td')
					).reverse();
					return {
						depth: section.depth,
						id: (idCell.textContent ?? '').trim(),
						name: (nameCell.textContent ?? '').trim(),
						labels: labelCells
							.map((cell) => (cell.textContent ?? '').trim())
							.reverse()
							.flatMap((label) => label.split(/：|、|，/))
							.map((label) => (label.match(/^\s*\[([^\[\]]+)\]/)?.[1] ?? label).trim())
							.filter((label) => !['', '-'].includes(label)),
						memo: (memoCell.textContent ?? '').trim(),
						...extractImageAndLink(memoCell, config)
					};
				}
			);
		} else if (/^H\d$/.test(tagName)) {
			const level = parseInt(tagName.substring(1), 10) - 1;
			const title = (childNode.textContent ?? '').trim();

			if (level === 1) {
				list = { id: lists.length + 1, title, count: 0, sections: [] };
				lists.push(list);
			} else {
				if (list == null) {
					continue;
				}
				list.sections.push({ text: title, depth: level, slug: '', groups: [] });
			}
		}
	}

	for (const list of lists) {
		const { sections } = list;
		let count = 0;
		const slugger = new GithubSlugger();
		for (const section of sections) {
			section.slug = slugger.slug(section.text);
			section.groups = section.groups.filter((row) => GroupSchema.safeParse(row).success);
			count += section.groups.length;
		}
		list.count = count;
	}

	const editDate = new Date(timestamp);

	return InfoSchema.parse({
		build: +buildDate,
		edit: +editDate,
		revid,
		title,
		lists
	});
}
