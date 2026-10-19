import { makeRouteHandler } from "@keystatic/next/route-handler";
import keystaticConfig from "../../../../keystatic.config";
import { cleanupOrphanedUploads } from "../../../../lib/cleanup-uploads";

const handlers = makeRouteHandler({ config: keystaticConfig });

export const { GET } = handlers;

// Wrap POST so every save through the admin UI also sweeps /public/uploads
// for images no longer referenced by any content entry — Keystatic's local
// writer replaces an image field's value but never deletes the old file on
// disk, so without this every "change image" leaves the previous upload
// behind.
export async function POST(request: Request) {
  const response = await handlers.POST(request);
  cleanupOrphanedUploads().catch((error) => {
    console.error("Upload cleanup failed:", error);
  });
  return response;
}
