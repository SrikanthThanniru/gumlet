import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

let cached: S3Client | null = null;

export function getS3Client() {
  if (cached) return cached;
  const env = getEnv();
  cached = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  });
  return cached;
}

