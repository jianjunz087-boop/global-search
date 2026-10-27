import { database } from "../db";
import { initialMarkets } from "./model";
export async function store() {
	const db = await database();
	await db.query(
		"CREATE TABLE IF NOT EXISTS intelligence_records (kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(kind,id))",
	);
	await db.query(
		"INSERT INTO intelligence_records VALUES ('meta','initialized','{}') ON CONFLICT DO NOTHING",
	);
	for (const market of initialMarkets)
		await db.query(
			"INSERT INTO intelligence_records VALUES ($1,$2,$3::jsonb) ON CONFLICT DO NOTHING",
			["market", market.id, JSON.stringify(market)],
		);
	await db.query(
		"CREATE UNIQUE INDEX IF NOT EXISTS intelligence_buyer_domain ON intelligence_records ((data->>'companyDomain')) WHERE kind='buyer'",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS intelligence_collection_guard (id text PRIMARY KEY, requested_at timestamptz NOT NULL)",
	);
	return db;
}
