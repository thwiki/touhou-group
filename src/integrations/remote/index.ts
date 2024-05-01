import type { AstroIntegration } from 'astro';
import { ZodError } from 'zod';
import { validateOptions } from './validate-options.js';
import { downloadData } from './download-data.js';
import { convertData } from './convert-data.js';

export type RemoteOptions =
	| {
			infoDestinationFile: string;
			jsonDestinationDir: string;
			imageDestinationRelDir: string;
			source: {
				revisionApi: string;
				parseApi: string;
				imageDomains: string[];
				imageExtensions: string[];
			};
	  }
	| undefined;

function formatConfigErrorMessage(err: ZodError) {
	const errorList = err.issues.map((issue) => ` ${issue.path.join('.')}  ${issue.message + '.'}`);
	return errorList.join('\n');
}

const PKG_NAME = 'remote';

const createPlugin = (options?: RemoteOptions): AstroIntegration => {
	return {
		name: PKG_NAME,

		hooks: {
			'astro:build:start': async ({ logger }) => {
				try {
					const opts = validateOptions(options);

					const {
						infoDestinationFile,
						jsonDestinationDir,
						imageDestinationRelDir,
						source: {
							revisionApi: sourceRevisionApi,
							parseApi: sourceParseApi,
							imageDomains,
							imageExtensions
						}
					} = opts;

					logger.info(`Loading data from source...`);
					const info = await convertData({
						sourceRevisionApi,
						sourceParseApi,
						imageDomains,
						imageExtensions
					});

					logger.info(`Saving data to: "${jsonDestinationDir}"...`);
					await downloadData(info, {
						infoDestinationFile,
						jsonDestinationDir,
						imageDestinationRelDir
					});
					logger.info(`Saved info to: "${infoDestinationFile}"`);
				} catch (err) {
					if (err instanceof ZodError) {
						logger.warn(formatConfigErrorMessage(err));
					} else {
						throw err;
					}
				}
			}
		}
	};
};

export default createPlugin;
