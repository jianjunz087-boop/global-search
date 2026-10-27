// Legacy local installers must never be served as the latest application.
export async function GET(req:Request){return Response.redirect(new URL(req.url).searchParams.has('checksum')?'https://github.com/jianjunz087-boop/global-search/releases/download/v1.0.3-demo.2/SHA256SUMS.txt':'https://github.com/jianjunz087-boop/global-search/releases/download/v1.0.3-demo.2/BAIHUA-AI-TRADE-Setup-1.0.3-win-x64.exe',307)}
export const HEAD=GET;
