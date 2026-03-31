import { VideoUploader } from "@/components/VideoUploader";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans text-zinc-900">
      <main className="w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            S3 Upload + Gumlet Player (Next.js)
          </h1>
          <p className="text-sm text-zinc-600">
            Simple demo: upload a video to S3, create a Gumlet asset from it, and
            embed the Gumlet player.
          </p>
        </div>

        <VideoUploader />
      </main>
    </div>
  );
}
