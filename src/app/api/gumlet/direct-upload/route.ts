import { NextResponse } from "next/server";
import { gumletCreateDirectUpload } from "@/lib/gumlet";

export const runtime = "nodejs";

type Body = {
  filename?: string;
  contentType?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const title = (body.filename || "").trim() || undefined;
    const { asset_id, upload_url } = await gumletCreateDirectUpload({
      title,
      format: "hls",
      keep_original: true,
      resolution: ["480p", "720p", "1080p"],
    });

    return NextResponse.json({ assetId: asset_id, uploadUrl: upload_url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

//test