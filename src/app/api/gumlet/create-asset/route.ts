import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { gumletCreateAssetFromUrl } from "@/lib/gumlet";
import { getS3Client } from "@/lib/s3";

export const runtime = "nodejs";

type Body = {
  key: string;
  // auto: try workspace-path first, then s3://, then signed url
  mode?: "auto" | "path" | "s3uri" | "presigned";
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = (body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  try {
    const env = getEnv();
    const mode = body.mode ?? "auto";

    const inputs: Array<{ label: string; value: string }> = [];

    // If workspace Source is set to S3, Gumlet can often import using the object path/key.
    // This matches how "migration from S3" works in the dashboard (paths like "file.mp4" or "folder/file.mp4").
    if (mode === "auto" || mode === "path") {
      inputs.push({ label: "path", value: key });
    }

    // Some workspaces accept explicit s3:// URLs.
    if (mode === "auto" || mode === "s3uri") {
      inputs.push({ label: "s3uri", value: `s3://${env.s3BucketName}/${key}` });
    }

    // Last resort: signed https URL (works only if Gumlet can fetch presigned URLs reliably).
    if (mode === "auto" || mode === "presigned") {
      const s3 = getS3Client();
      const presigned = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: env.s3BucketName, Key: key }),
        { expiresIn: 60 * 60 * 12 },
      );
      inputs.push({ label: "presigned", value: presigned });
    }

    const errors: Array<{ label: string; message: string }> = [];
    for (const candidate of inputs) {
      try {
        const { asset_id } = await gumletCreateAssetFromUrl(candidate.value);
        return NextResponse.json({ assetId: asset_id, inputModeUsed: candidate.label });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ label: candidate.label, message });
      }
    }

    return NextResponse.json(
      {
        error: "Gumlet import failed for all input formats.",
        attempts: errors,
        hint:
          "If Gumlet dashboard S3 migration works, use mode:'path' and ensure the 'key' matches the exact object path Gumlet sees in that workspace source.",
      },
      { status: 500 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

