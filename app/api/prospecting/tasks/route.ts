import { prospectDB } from "@/lib/prospecting/store";
import { pumpTasks, taskResponse, createTask } from "@/lib/prospecting/service";
export async function GET(req: Request) {
	try {
		const db = await prospectDB();
		await db.query(
			"UPDATE discovery_tasks SET data=data || jsonb_build_object('state','interrupted') WHERE data->>'state'='running' AND (data->>'startedAt')::timestamptz<now()-interval '5 minutes'",
		);
		void pumpTasks();
		const id = new URL(req.url).searchParams.get("id");
		if (id) {
			const result = await taskResponse(id);
			return result
				? Response.json(result)
				: Response.json({ code: "NOT_FOUND" }, { status: 404 });
		}
		const rows = await db.query(
			"SELECT data FROM discovery_tasks ORDER BY created_at DESC LIMIT 50",
		);
		return Response.json({
			tasks: rows.rows.map((r) => r.data),
			worker:
				"Application-local queue; runs while the app server is active. Not an external scheduler.",
			usage: {
				requestsAttempted: rows.rows.reduce(
					(n, r) => n + (r.data.usage ?? 0),
					0,
				),
				scope:
					"Last 50 tasks only; provider billing and remaining quota are unknown.",
			},
		});
	} catch {
		return Response.json({ code: "DATABASE_ERROR" }, { status: 503 });
	}
}
export async function POST(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json({ code: "CROSS_ORIGIN" }, { status: 403 });
		const body = await req.json(),
			db = await prospectDB();
		if (body.action === "cancel") {
			const r = await db.query(
				"UPDATE discovery_tasks SET data=data || jsonb_build_object('state','cancelled') WHERE id=$1 AND data->>'state'='queued' RETURNING data",
				[body.id],
			);
			return r.rows.length
				? Response.json({ task: r.rows[0].data })
				: Response.json({ code: "ONLY_QUEUED_CAN_CANCEL" }, { status: 409 });
		}
		if (body.action === "retry") {
			const old = (
				await db.query("SELECT data FROM discovery_tasks WHERE id=$1", [
					body.id,
				])
			).rows[0]?.data;
			if (!old) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
			const task = await createTask(
				{ ...old.query, filters: old.savedFilter },
				old.kind,
			);
			return Response.json({ taskId: task.id }, { status: 202 });
		}
		return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
	} catch {
		return Response.json({ code: "DATABASE_ERROR" }, { status: 503 });
	}
}
