import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { exportApprovedQuestions } from "@/lib/db/questions.js";

export const dynamic = "force-dynamic";

/** Downloads the current course's approved questions as a content-format file. */
export async function GET() {
  const { user, exam } = await getAppContext();
  if (!exam) return new Response("No course selected", { status: 404 });
  const data = await withUser(user.id, (db) => exportApprovedQuestions(db, exam.id));
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${exam.code.toLowerCase()}-approved-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
