import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getS3Client } from "@/lib/s3";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  try {
    const env = getEnv();
    const s3 = getS3Client();
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: env.s3BucketName, Key: key }),
      { expiresIn: 60 * 30 },
    );
    return NextResponse.json({ url: signedUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

