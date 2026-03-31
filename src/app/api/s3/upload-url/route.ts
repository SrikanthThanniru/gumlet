import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getS3Client } from "@/lib/s3";

export const runtime = "nodejs";

type Body = {
  filename: string;
  contentType: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = (body.filename || "").trim();
  const contentType = (body.contentType || "").trim();

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }

  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only video/* content types are allowed" },
      { status: 400 },
    );
  }

  try {
    const safeName = filename.replace(/[^\w.\-()]/g, "_");
    const key = `uploads/${randomUUID()}-${safeName}`;
    const env = getEnv();
    const s3 = getS3Client();

    const cmd = new PutObjectCommand({
      Bucket: env.s3BucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });

    return NextResponse.json({ uploadUrl, key });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

