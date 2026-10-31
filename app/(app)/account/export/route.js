import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { exportUserData } from "@/lib/db/export.js";

export const dynamic = "force-dynamic";

/** Downloads everything the signed-in user owns as one JSON file. */
export async function GET() {
  const user = await requireUser();
  const data = await withUser(user.id, (db) => exportUserData(db));
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="certprep-export-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
