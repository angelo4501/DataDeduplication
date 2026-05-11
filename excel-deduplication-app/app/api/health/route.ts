import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "excel-deduplication-app",
    timestamp: new Date().toISOString(),
  });
}
