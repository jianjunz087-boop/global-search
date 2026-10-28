import { enqueueSearch } from "@/lib/prospecting/service";
import { database } from "@/lib/db";
import { createSearchHandler } from "@/lib/search";
const legacyPOST = createSearchHandler({
	key: () => process.env.SERPAPI_API_KEY,
	fetcher: (...args) => fetch(...args),
	repository: {
		async save(leads) {
			const db = await database();
			const saved = [];
			let added = 0;
			for (const lead of leads) {
				const insert = await db.query(
					"INSERT INTO leads VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING data",
					[lead.id, JSON.stringify(lead)],
				);
				if (insert.rows.length) {
					saved.push(insert.rows[0].data);
					added++;
				} else {
					const existing = await db.query(
						"SELECT data FROM leads WHERE id=$1",
						[lead.id],
					);
					if (existing.rows[0]) saved.push(existing.rows[0].data);
				}
			}
			return { leads: saved, added };
		},
	},
});

export async function POST(req: Request) {
	const body = await req
		.clone()
		.json()
		.catch(() => null);
	return body?.engine ? enqueueSearch(req) : legacyPOST(req);
}
