import { getEnv } from "@/lib/env";

export type GumletCreateAssetResponse = {
  asset_id: string;
};

export type GumletCreateDirectUploadResponse = {
  asset_id: string;
  upload_url: string;
};

export type GumletAssetStatusResponse = {
  asset_id: string;
  status?: string;
  progress?: number;
  playback_url?: string;
  dash_playback_url?: string;
  source_url?: string;
  // Gumlet may include additional fields; we only depend on a few.
  [key: string]: unknown;
};

export async function gumletCreateAssetFromUrl(inputUrl: string) {
  const env = getEnv();
  const res = await fetch("https://api.gumlet.com/v1/video/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.gumletApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: inputUrl,
      collection_id: env.gumletCollectionId,
      format: "ABR",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gumlet create asset failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GumletCreateAssetResponse;
}

export async function gumletCreateDirectUpload(params: {
  title?: string;
  format?: "hls" | "ABR" | "mp4";
  keep_original?: boolean;
}) {
  const env = getEnv();
  const res = await fetch("https://api.gumlet.com/v1/video/assets/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.gumletApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_id: env.gumletSourceId,
      format: params.format ?? "hls",
      keep_original: params.keep_original ?? true,
      ...(params.title ? { title: params.title } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gumlet direct upload init failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GumletCreateDirectUploadResponse;
}

export async function gumletGetAssetStatus(assetId: string) {
  const env = getEnv();
  const res = await fetch(`https://api.gumlet.com/v1/video/assets/${assetId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.gumletApiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gumlet get status failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GumletAssetStatusResponse;
}

