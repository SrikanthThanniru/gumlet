## S3 Upload + Gumlet Player (Next.js)

Minimal demo app:

- Upload a video from the browser to **Amazon S3** using a **pre-signed PUT URL**
- Backend calls **Gumlet Create Asset** with `s3://bucket/key` (requires Gumlet workspace S3 Source integration)
- UI embeds the **Gumlet player** using the returned `assetId`
- (Recommended) Upload a video **directly to Gumlet** using Gumlet **Direct Upload**

## Getting Started

### 1) Configure environment

Copy `.env.local.example` to `.env.local` and fill values:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `GUMLET_API_KEY`
- `GUMLET_COLLECTION_ID`
- `GUMLET_SOURCE_ID` (optional; if omitted we reuse `GUMLET_COLLECTION_ID`)

### 2) Run the dev server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### API routes

- `POST /api/s3/upload-url` → returns `{ uploadUrl, key }`
- `POST /api/gumlet/create-asset` → returns `{ assetId }`
- `POST /api/gumlet/direct-upload` → returns `{ assetId, uploadUrl }`

### Notes

- For **S3 → Gumlet** imports, configure your Gumlet workspace Source as **Amazon S3 (Object Storage)** and grant Gumlet `ListBucket` + `GetObject`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
