import { closeDatabase } from "../lib/db";
import { prospectDB } from "../lib/prospecting/store";
import { store } from "../lib/intelligence/store";
await store();
await prospectDB();
console.log(
	"Idempotent CRM and intelligence and prospecting schema migration complete; 17 DEMO market scenarios, no intelligence buyer seeds.",
);
await closeDatabase();
