import {
	allProspects,
	prospectDB,
	decorateLeads,
} from "@/lib/prospecting/store";
import {
	prospectsCSV,
	exportHeaders,
	exportRows,
	safeCell,
} from "@/lib/prospecting/export";
export async function GET(req: Request) {
	try {
		const url = new URL(req.url),
			ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
		if (ids.length > 1000)
			return Response.json(
				{ error: "Maximum 1000 records per export" },
				{ status: 400 },
			);
		let leads = await allProspects();
		if (ids.length) leads = leads.filter((l) => ids.includes(l.id));
		const db = await prospectDB();
		leads = await decorateLeads(db, leads, true);
		if (url.searchParams.get("format") === "xlsx") {
			const { default: ExcelJS } = await import("exceljs");
			const wb = new ExcelJS.Workbook();
			const sheet = wb.addWorksheet("B2B evidence");
			sheet.addRow(exportHeaders);
			exportRows(leads).forEach((row) => sheet.addRow(row.map(safeCell)));
			const buffer = await wb.xlsx.writeBuffer();
			return new Response(new Uint8Array(buffer), {
				headers: {
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"Content-Disposition":
						'attachment; filename="BAIHUA-B2B-evidence.xlsx"',
				},
			});
		}
		return new Response(prospectsCSV(leads), {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": 'attachment; filename="BAIHUA-B2B-evidence.csv"',
			},
		});
	} catch {
		return Response.json(
			{ error: "Unable to export database records" },
			{ status: 503 },
		);
	}
}
