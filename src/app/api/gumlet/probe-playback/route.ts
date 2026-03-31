import { NextResponse } from "next/server";
import { gumletGetAssetStatus } from "@/lib/gumlet";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assetId = (url.searchParams.get("assetId") || "").trim();
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  try {
    const status = await gumletGetAssetStatus(assetId);
    const playbackUrl =
      (typeof status.playback_url === "string" && status.playback_url) || "";

    if (!playbackUrl) {
      return NextResponse.json(
        { error: "No playback_url yet", status },
        { status: 409 },
      );
    }

    const res = await fetch(playbackUrl, { method: "GET" });
    const text = await res.text().catch(() => "");

    return NextResponse.json({
      playbackUrl,
      httpStatus: res.status,
      ok: res.ok,
      sample: text.slice(0, 300),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

