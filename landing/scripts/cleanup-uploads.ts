import { cleanupOrphanedUploads } from "../lib/cleanup-uploads";

cleanupOrphanedUploads()
  .then(({ deleted }) => {
    console.log(deleted.length ? `Deleted ${deleted.length} orphaned file(s).` : "No orphaned uploads found.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
