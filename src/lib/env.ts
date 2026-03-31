export type Env = {
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  s3BucketName: string;
  gumletApiKey: string;
  gumletCollectionId: string;
  gumletSourceId: string;
};

function required(name: keyof NodeJS.ProcessEnv): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = {
    awsRegion: required("AWS_REGION"),
    awsAccessKeyId: required("AWS_ACCESS_KEY_ID"),
    awsSecretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    s3BucketName: required("S3_BUCKET_NAME"),
    gumletApiKey: required("GUMLET_API_KEY"),
    gumletCollectionId: required("GUMLET_COLLECTION_ID"),
    gumletSourceId: process.env.GUMLET_SOURCE_ID || required("GUMLET_COLLECTION_ID"),
  };
  return cached;
}

