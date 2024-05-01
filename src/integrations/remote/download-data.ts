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
	await rm(jsonDestinationDir, { recursive: true });
	await mkdir(jsonDestinationDir, { recursive: true });
	await mkdir(`${jsonDestinationDir}/${imageDestinationRelDir}`, { recursive: true });

	for (const list of info.lists) {
		const writePath = path.join(jsonDestinationDir, `${list.title}.json`);
		const { sections } = list;

		const images: {
			source: string;
			target: string;
		}[] = [];
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

		await Promise.all(
			images.map(async (image) =>
				writeFile(
					path.join(jsonDestinationDir, image.target),
					Buffer.from(await (await fetch(image.source)).arrayBuffer())
				)
			)
		);
	}

	await writeFile(infoDestinationFile, JSON.stringify(info), 'utf-8');
}
