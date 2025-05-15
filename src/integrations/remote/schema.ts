import { z } from 'zod';
import { REMOTE_CONFIG_DEFAULTS } from './config-defaults.js';

export const RemoteOptionsSchema = z
	.object({
		infoDestinationFile: z.string().optional().default(REMOTE_CONFIG_DEFAULTS.infoDestinationFile),
		jsonDestinationDir: z.string().optional().default(REMOTE_CONFIG_DEFAULTS.jsonDestinationDir),
		imageDestinationRelDir: z
			.string()
			.optional()
			.default(REMOTE_CONFIG_DEFAULTS.imageDestinationRelDir),
		source: z.object({
			revisionApi: z.string().url(),
			parseApi: z.string().url(),
			imageDomains: z
				.array(z.string())
				.optional()
				.default(REMOTE_CONFIG_DEFAULTS.source.imageDomains),
			imageExtensions: z
				.array(z.string())
				.optional()
				.default(REMOTE_CONFIG_DEFAULTS.source.imageExtensions)
		})
	})
	.strict()
	.default(REMOTE_CONFIG_DEFAULTS);

export const SourceRevisionSchema = z.object({
	query: z.object({
		pages: z
			.array(
				z.object({
					pageid: z.number(),
					ns: z.number(),
					title: z.string(),
					revisions: z
						.array(
							z.object({
								revid: z.number(),
								parentid: z.number().optional(),
								timestamp: z.string().datetime()
							})
						)
						.min(1)
				})
			)
			.min(1)
	})
});

export const SourceParseSchema = z.object({
	parse: z.object({
		title: z.string(),
		pageid: z.number(),
		text: z.string()
	})
});

export const GroupSchema = z.object({
	id: z.string().regex(/^\d+$/, { message: 'Must be numeric' }),
	name: z.string().min(1),
	labels: z.array(z.string()),
	labelsLength: z.number(),
	memo: z.string(),
	image: z.string().url().optional(),
	link: z.string().url().optional()
});

export const SectionSchema = z.object({
	depth: z.number(),
	slug: z.string(),
	text: z.string(),
	groups: z.array(GroupSchema)
});

export const ListSchema = z.object({
	id: z.number(),
	title: z.string(),
	count: z.number(),
	sections: z.array(SectionSchema)
});

export const InfoSchema = z.object({
	build: z.number().positive().finite(),
	edit: z.number().positive().finite(),
	revid: z.number(),
	title: z.string(),
	lists: z.array(ListSchema)
});
