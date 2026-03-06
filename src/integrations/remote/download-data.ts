import path from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { z } from 'zod';
import type { InfoSchema } from './schema';

type DownloadDataConfig = {
	infoDestinationFile: string;
	jsonDestinationDir: string;
	imageDestinationRelDir: string;
};

export async function downloadData(
	info: z.infer<typeof InfoSchema>,
	{ infoDestinationFile, jsonDestinationDir, imageDestinationRelDir }: DownloadDataConfig
) {
	await rm(jsonDestinationDir, { recursive: true, force: true });
	await mkdir(jsonDestinationDir, { recursive: true });
	await mkdir(`${jsonDestinationDir}/${imageDestinationRelDir}`, { recursive: true });

	const images: {
		source: string;
		target: string;
	}[] = [];

	for (const list of info.lists) {
		if (list.title === '注释') {
			continue;
		}
		const writePath = path.join(jsonDestinationDir, `${list.title}.json`);
		const { sections } = list;

		for (const section of sections) {
			for (const group of section.groups) {
				if (group.image) {
					const target = `./${imageDestinationRelDir}/${group.id}${path.extname(group.image)}`;
					images.push({
						source: group.image,
						target
					});
					group.image = target;
				}
			}
		}

		await writeFile(writePath, JSON.stringify(list), 'utf-8');
	}

	// 限制最大并发数，避免同时打开过多 TLS 连接导致握手失败
	const CONCURRENCY = 8;
	for (let i = 0; i < images.length; i += CONCURRENCY) {
		await Promise.all(
			images.slice(i, i + CONCURRENCY).map(async (image) => {
				const response = await fetch(image.source);
				const buffer = Buffer.from(await response.arrayBuffer());
				await writeFile(path.join(jsonDestinationDir, image.target), buffer);
			})
		);
	}

	await writeFile(infoDestinationFile, JSON.stringify(info), 'utf-8');
}
