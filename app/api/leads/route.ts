import { database } from "@/lib/db";
import { allProspects } from "@/lib/prospecting/store";
export async function GET() {
	try {
		return Response.json(await allProspects());
	} catch {
		return Response.json(
			{
				error:
					"Database unavailable. Configure DATABASE_URL and start PostgreSQL.",
			},
			{ status: 503 },
		);
	}
}
export async function PATCH(req: Request) {
	try {
		const body = await req.json();
		if (typeof body.id !== "string")
			return Response.json({ error: "Invalid ID" }, { status: 400 });
		const updates: Record<string, string> = {};
		for (const k of ["status", "note", "nextFollowUp"])
			if (typeof body[k] === "string") updates[k] = body[k].slice(0, 10000);
		if (
			updates.status &&
			!["New", "Contacted", "Qualified", "Negotiating", "Won", "Lost"].includes(
				updates.status,
			)
		)
			return Response.json({ error: "Invalid status" }, { status: 400 });
		if (
			updates.nextFollowUp &&
			!/^\d{4}-\d{2}-\d{2}$/.test(updates.nextFollowUp)
		)
			return Response.json({ error: "Invalid date" }, { status: 400 });
		const db = await database();
		const r = await db.query(
			"UPDATE leads SET data=data || $2::jsonb WHERE id=$1 RETURNING data",
			[body.id, JSON.stringify(updates)],
		);
		return r.rowCount
			? Response.json(r.rows[0].data)
			: Response.json({ error: "Not found" }, { status: 404 });
	} catch {
		return Response.json({ error: "Unable to save" }, { status: 500 });
	}
}
