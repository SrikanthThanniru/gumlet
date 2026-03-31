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
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

