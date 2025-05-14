import { z, defineCollection } from 'astro:content';

const listsCollection = defineCollection({
	type: 'data',
	schema: ({ image }) =>
		z.object({
			id: z.number(),
			title: z.string(),
			count: z.number(),
			sections: z.array(
				z.object({
					depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
					slug: z.string(),
					text: z.string(),
					groups: z.array(
						z.object({
							depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
							id: z.string().regex(/^\d+$/, { message: 'Must be numeric' }),
							name: z.string().min(1),
							labels: z.array(z.string()),
							memo: z.string(),
							image: image().optional(),
							link: z.string().url().optional()
						})
					)
				})
			)
		})
});

export const collections = {
	lists: listsCollection
};
