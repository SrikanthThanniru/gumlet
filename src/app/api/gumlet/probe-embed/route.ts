import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assetId = (url.searchParams.get("assetId") || "").trim();
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  try {
    const embedUrl = `https://play.gumlet.io/embed/${assetId}`;
    const res = await fetch(embedUrl, { method: "GET" });
    const text = await res.text().catch(() => "");

    return NextResponse.json({
      embedUrl,
      httpStatus: res.status,
      ok: res.ok,
      sample: text.slice(0, 500),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

