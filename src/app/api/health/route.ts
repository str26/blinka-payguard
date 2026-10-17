export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", service: "blinka-payguard", scope: "application-only" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
