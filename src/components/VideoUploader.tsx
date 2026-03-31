"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UploadUrlResponse = { uploadUrl: string; key: string };
type CreateAssetResponse = { assetId: string };
type GumletDirectUploadInit = { assetId: string; uploadUrl: string };
type AssetStatusResponse = {
  asset_id: string;
  status?: string;
  progress?: number;
  playback_url?: string;
  dash_playback_url?: string;
  source_url?: string;
  access_control?: string;
  access_controls?: { private?: boolean } | unknown;
  error?: unknown;
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function VideoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<AssetStatusResponse | null>(null);
  const [signedGetUrl, setSignedGetUrl] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [probeEmbed, setProbeEmbed] = useState<string | null>(null);
  const [playerMode, setPlayerMode] = useState<"gumlet" | "hls">("gumlet");
  const [hlsLevels, setHlsLevels] = useState<Array<{ index: number; height: number }>>([]);
  const [selectedQuality, setSelectedQuality] = useState<number | "auto">("auto");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  function renderValue(v: unknown) {
    if (typeof v === "string") return v;
    if (v == null) return "";
    if (v instanceof Error) return v.message;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return { name: file.name, size: file.size, type: file.type || "unknown" };
  }, [file]);

  useEffect(() => {
    if (!assetId) {
      setAssetStatus(null);
      return;
    }

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/gumlet/asset-status?assetId=${assetId}`);
        const data = (await res.json()) as AssetStatusResponse;
        if (cancelled) return;
        setAssetStatus(data);

        const s = (data.status || "").toLowerCase();
        if (s === "ready" || s === "completed" || s === "failed" || data.error) {
          clearInterval(timer);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [assetId]);

  useEffect(() => {
    // HLS.js wiring for reliable in-app playback
    if (playerMode !== "hls") return;
    const url = assetStatus?.playback_url;
    const video = videoRef.current;
    if (!url || !video) return;

    let hls: any = null;
    let cancelled = false;

    (async () => {
      const mod = await import("hls.js");
      const Hls = mod.default;

      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        setHlsLevels([]);
        setSelectedQuality("auto");

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const allowedHeights = new Set([480, 720, 1080]);
          const levels = (hls.levels || [])
            .map((lvl: any, index: number) => ({
              index,
              height: typeof lvl?.height === "number" ? lvl.height : 0,
            }))
            .filter((x: { height: number }) => allowedHeights.has(x.height))
            .sort((a: { height: number }, b: { height: number }) => a.height - b.height);

          setHlsLevels(levels);
          // keep Auto by default; user can override
          hls.currentLevel = -1;
          hls.autoLevelEnabled = true;
        });

        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari
        video.src = url;
      } else {
        setError("This browser cannot play HLS.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        hlsRef.current = null;
        if (hls) hls.destroy();
      } catch {
        // ignore
      }
    };
  }, [playerMode, assetStatus?.playback_url]);

  useEffect(() => {
    if (playerMode !== "hls") return;
    const hls = hlsRef.current;
    if (!hls) return;

    if (selectedQuality === "auto") {
      hls.currentLevel = -1;
      return;
    }

    hls.currentLevel = selectedQuality;
  }, [playerMode, selectedQuality]);

  useEffect(() => {
    if (!key) {
      setSignedGetUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/s3/signed-get?key=${encodeURIComponent(key)}`);
        const data = (await res.json()) as { url?: string };
        if (cancelled) return;
        setSignedGetUrl(typeof data.url === "string" ? data.url : null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setKey(null);
    setAssetId(null);
    setAssetStatus(null);
    setSignedGetUrl(null);
    setProbe(null);
    setProbeEmbed(null);
    setPlayerMode("gumlet");
    setHlsLevels([]);
    setSelectedQuality("auto");

    try {
      const uploadUrlRes = await fetch("/api/s3/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      if (!uploadUrlRes.ok) {
        throw new Error(await uploadUrlRes.text());
      }

      const { uploadUrl, key } = (await uploadUrlRes.json()) as UploadUrlResponse;
      setKey(key);

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`S3 upload failed (${putRes.status})`);
      }

      const gumletRes = await fetch("/api/gumlet/create-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, mode: "auto" }),
      });
      if (!gumletRes.ok) {
        throw new Error(await gumletRes.text());
      }

      const { assetId } = (await gumletRes.json()) as CreateAssetResponse;
      setAssetId(assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDirectToGumlet() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setKey(null);
    setAssetId(null);
    setAssetStatus(null);
    setSignedGetUrl(null);
    setProbe(null);
    setProbeEmbed(null);
    setPlayerMode("gumlet");
    setHlsLevels([]);
    setSelectedQuality("auto");

    try {
      const initRes = await fetch("/api/gumlet/direct-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!initRes.ok) throw new Error(await initRes.text());
      const { assetId, uploadUrl } = (await initRes.json()) as GumletDirectUploadInit;

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
        redirect: "follow",
      });
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "");
        throw new Error(`Gumlet upload failed (${putRes.status}) ${t}`.trim());
      }

      setAssetId(assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-zinc-900">
              Upload video → Create Gumlet asset → Play
            </div>
            <div className="text-sm text-zinc-600">
              Uploads directly to S3 using a pre-signed URL.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onUploadDirectToGumlet}
              disabled={!file || busy}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload to Gumlet (best)"}
            </button>
            <button
              type="button"
              onClick={onUpload}
              disabled={!file || busy}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload to S3 (import)"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="text-sm font-medium text-zinc-900">Video file</div>
            <input
              className="mt-2 block w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-900"
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {fileMeta && (
              <div className="mt-2 text-xs text-zinc-600">
                {fileMeta.name} · {formatBytes(fileMeta.size)} · {fileMeta.type}
              </div>
            )}
          </label>

          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Status</div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {error ? (
                <div className="text-red-700">{error}</div>
              ) : assetId ? (
                <div className="space-y-1">
                  <div>
                    Created Gumlet asset: <span className="font-mono">{assetId}</span>
                  </div>
                  {assetStatus?.error ? (
                    <div className="text-red-700">{renderValue(assetStatus.error)}</div>
                  ) : assetStatus?.status ? (
                    <div className="text-xs text-zinc-600">
                      Gumlet status:{" "}
                      <span className="font-mono">{assetStatus.status}</span>
                      {typeof assetStatus.progress === "number"
                        ? ` · ${assetStatus.progress}%`
                        : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-600">Checking Gumlet status…</div>
                  )}
                  {assetStatus?.access_control === "private" ? (
                    <div className="text-xs font-semibold text-amber-700">
                      This asset is <span className="font-mono">private</span> in Gumlet, so it
                      won’t play in embeds. Change workspace/video privacy to{" "}
                      <span className="font-mono">unlisted</span> or{" "}
                      <span className="font-mono">public</span>.
                    </div>
                  ) : null}
                  {assetStatus ? (
                    <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                      {"access_control" in assetStatus ? (
                        <div>
                          access_control:{" "}
                          <span className="font-mono">
                            {renderValue(assetStatus.access_control)}
                          </span>
                        </div>
                      ) : null}
                      {"access_controls" in assetStatus ? (
                        <div>
                          access_controls:{" "}
                          <span className="font-mono">
                            {renderValue(assetStatus.access_controls)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <a
                          className="font-semibold text-blue-700 underline"
                          href={`https://play.gumlet.io/embed/${assetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open embed URL
                        </a>
                        {assetStatus.playback_url ? (
                          <a
                            className="font-semibold text-blue-700 underline"
                            href={assetStatus.playback_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open HLS (m3u8)
                          </a>
                        ) : null}
                      </div>
                      <div className="text-[11px]">
                        If embed URL opens but video doesn’t play on localhost, check Gumlet{" "}
                        <span className="font-mono">Allow Referrers</span> (whitelist{" "}
                        <span className="font-mono">localhost</span>).
                      </div>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center text-[11px] font-semibold text-blue-700 underline"
                        onClick={async () => {
                          setProbe("Probing…");
                          try {
                            const r = await fetch(
                              `/api/gumlet/probe-playback?assetId=${assetId}`,
                            );
                            const t = await r.text();
                            setProbe(t);
                          } catch (e) {
                            setProbe(
                              e instanceof Error ? e.message : "Probe failed unexpectedly",
                            );
                          }
                        }}
                      >
                        Probe playback (server-side)
                      </button>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center text-[11px] font-semibold text-blue-700 underline"
                        onClick={async () => {
                          setProbeEmbed("Probing embed…");
                          try {
                            const r = await fetch(
                              `/api/gumlet/probe-embed?assetId=${assetId}`,
                            );
                            const t = await r.text();
                            setProbeEmbed(t);
                          } catch (e) {
                            setProbeEmbed(
                              e instanceof Error ? e.message : "Probe failed unexpectedly",
                            );
                          }
                        }}
                      >
                        Probe embed (server-side)
                      </button>
                      {probe ? (
                        <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-2 text-[10px] text-zinc-700">
                          {probe}
                        </pre>
                      ) : null}
                      {probeEmbed ? (
                        <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-2 text-[10px] text-zinc-700">
                          {probeEmbed}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : key ? (
                <div className="space-y-2">
                  <div>
                    Uploaded to S3 key: <span className="font-mono">{key}</span>
                  </div>
                  {signedGetUrl ? (
                    <a
                      className="inline-flex items-center text-xs font-semibold text-blue-700 underline"
                      href={signedGetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Test download (signed S3 URL)
                    </a>
                  ) : (
                    <div className="text-xs text-zinc-600">
                      Preparing a signed download URL…
                    </div>
                  )}
                </div>
              ) : (
                <div>Select a video to begin.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900">Player</div>
          {assetId ? (
            <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs">
              <button
                type="button"
                onClick={() => setPlayerMode("gumlet")}
                className={`rounded-lg px-3 py-1 font-semibold ${
                  playerMode === "gumlet"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Gumlet Embed
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode("hls")}
                className={`rounded-lg px-3 py-1 font-semibold ${
                  playerMode === "hls"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                HLS (in-app)
              </button>
            </div>
          ) : null}
        </div>
        {assetId ? (
          playerMode === "gumlet" ? (
            <div className="w-full overflow-hidden rounded-xl bg-black">
              <iframe
                className="block h-[500px] w-full"
                src={`https://play.gumlet.io/embed/${assetId}`}
                title="Gumlet video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="origin"
              />
            </div>
          ) : (
            <div className="w-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-zinc-900">Quality</div>
                <select
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-900"
                  value={selectedQuality}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedQuality(v === "auto" ? "auto" : Number(v));
                  }}
                >
                  <option value="auto">Auto</option>
                  {hlsLevels.map((l) => (
                    <option key={l.index} value={l.index}>
                      {l.height}p
                    </option>
                  ))}
                </select>
              </div>

              <video
                ref={videoRef}
                className="block h-[500px] w-full"
                controls
                playsInline
              />
              {hlsLevels.length === 0 ? (
                <div className="text-[11px] text-zinc-600">
                  Available qualities will appear once the manifest loads. (Showing only 480p /
                  720p / 1080p.)
                </div>
              ) : null}
            </div>
          )
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-900 text-sm text-zinc-200">
            Upload a video to see the Gumlet player here.
          </div>
        )}
      </div>
    </div>
  );
}

