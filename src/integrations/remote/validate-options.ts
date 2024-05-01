import type { RemoteOptions } from './index.js';
import { RemoteOptionsSchema } from './schema.js';

// @internal
export const validateOptions = (opts: RemoteOptions) => {
	const result = RemoteOptionsSchema.parse(opts);

	return result;
};
