import path from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { z } from 'zod';
import type { InfoSchema } from './schema';

type DownloadDataConfig = {
	infoDestinationFile: string;
	jsonDestinationDir: string;
	imageDestinationRelDir: string;
};

export type DownloadLogger = {
	info: (message: string) => void;
	warn: (message: string) => void;
};

const CONCURRENCY = 8;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_JITTER_MS = 250;
const REQUEST_TIMEOUT_MS = 30_000;
const PROGRESS_EVERY_N_IMAGES = 20;
const USER_AGENT = 'touhou-group-build/2.x (https://touhou.group; build script)';

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly url: string,
		readonly retryable: boolean
	) {
		super(`HTTP ${status} for "${url}"`);
		this.name = 'HttpError';
	}
}

function isRetryableStatus(status: number) {
	return status === 408 || status === 429 || status >= 500;
}

function describeError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(source: string, logger?: DownloadLogger): Promise<Buffer> {
	for (let attempt = 0; ; attempt++) {
		try {
			const response = await fetch(source, {
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				headers: { 'User-Agent': USER_AGENT }
			});
			if (!response.ok) {
				throw new HttpError(response.status, source, isRetryableStatus(response.status));
			}
			return Buffer.from(await response.arrayBuffer());
		} catch (error) {
			if (error instanceof HttpError && !error.retryable) {
				throw error;
			}
			if (attempt >= MAX_RETRIES) {
				throw new Error(
					`Failed to download "${source}" after ${attempt + 1} attempts: ${describeError(error)}`,
					{ cause: error }
				);
			}
			const delay = RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * RETRY_MAX_JITTER_MS;
			logger?.warn(
				`Retrying "${source}" in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${describeError(error)}`
			);
			await sleep(delay);
		}
	}
}

export async function downloadData(
	info: z.infer<typeof InfoSchema>,
	{ infoDestinationFile, jsonDestinationDir, imageDestinationRelDir }: DownloadDataConfig,
	logger?: DownloadLogger
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

	// 多个群组可能引用同一张图片：按 source 去重，只下载一次，写入所有目标文件
	const targetsBySource = new Map<string, string[]>();
	for (const image of images) {
		const targets = targetsBySource.get(image.source);
		if (targets) {
			targets.push(image.target);
		} else {
			targetsBySource.set(image.source, [image.target]);
		}
	}
	const downloads = [...targetsBySource.entries()];

	// 固定 worker 数量的并发池：任一慢请求只占用一个 worker，不再拖慢整批；
	// 重试与超时在 downloadImage 内部处理，瞬时的 TLS/网络错误不会直接打挂构建
	let nextIndex = 0;
	let completed = 0;

	const worker = async () => {
		while (nextIndex < downloads.length) {
			const [source, targets] = downloads[nextIndex++];
			const buffer = await downloadImage(source, logger);
			await Promise.all(
				targets.map((target) => writeFile(path.join(jsonDestinationDir, target), buffer))
			);
			completed++;
			if (completed % PROGRESS_EVERY_N_IMAGES === 0 || completed === downloads.length) {
				logger?.info(`Downloaded ${completed}/${downloads.length} images`);
			}
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, downloads.length) }, () => worker())
	);

	await writeFile(infoDestinationFile, JSON.stringify(info), 'utf-8');
}
