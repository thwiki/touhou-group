import type { RemoteOptions } from './index.js';

export const REMOTE_CONFIG_DEFAULTS = {
	infoDestinationFile: 'public/info.json',
	jsonDestinationDir: 'src/content/lists',
	imageDestinationRelDir: 'images',
	imageConcurrency: 8,
	source: {
		revisionApi: '',
		parseApi: '',
		imageDomains: [],
		imageExtensions: ['.jpg', '.jpeg', '.png', '.apng', '.gif', '.webp']
	}
} satisfies RemoteOptions;
