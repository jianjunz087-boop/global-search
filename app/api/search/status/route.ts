export async function GET(){return Response.json({configured:!!process.env.SERPAPI_API_KEY?.trim(),desktop:!!process.env.DESKTOP_DATA_DIR},{headers:{'Cache-Control':'no-store'}})}
