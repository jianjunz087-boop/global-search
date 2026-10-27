import { store } from "@/lib/intelligence/store";
import { createCollectionHandler } from "@/lib/intelligence/collection";
export const POST = createCollectionHandler({
	database: store,
	key: () => process.env.SERPAPI_API_KEY,
	fetcher: fetch,
});
