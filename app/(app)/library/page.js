import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { listQuestions } from "@/lib/db/questions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { indexExam } from "@/lib/app/view.js";
import {
  Badge,
  Button,
  buttonClass,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  CheckChip,
} from "@/components/ui/index.js";

export const metadata = { title: "Library" };
const PAGE = 50;

export default async function LibraryPage({ searchParams }) {
  const sp = await searchParams;
  const { user, exam: active } = await getAppContext();
  if (!active)
    return (
      <EmptyState
        title="No course selected"
        action={
          <LinkButton href="/courses" variant="primary">
            Choose a course
          </LinkButton>
        }
      />
    );

  const filters = {
    reviewStatus: ["draft", "approved", "rejected"].includes(sp.status) ? sp.status : undefined,
    domainId: isUuid(sp.domain) ? sp.domain : undefined,
    objectiveId: isUuid(sp.objective) ? sp.objective : undefined,
    search: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 100) : undefined,
    type: ["single", "multi", "tf"].includes(sp.type) ? sp.type : undefined,
    origin: ["bank", "mine"].includes(sp.origin) ? sp.origin : undefined,
    flagged: sp.flagged === "1",
  };
  const page = Math.max(0, Number.parseInt(sp.page ?? "0", 10) || 0);
  const { exam, questions } = await withUser(user.id, async (db) => ({
    exam: await getExam(db, active.id),
    questions: await listQuestions(db, active.id, {
      ...filters,
      limit: PAGE + 1,
      offset: page * PAGE,
    }),
  }));
  const { objectiveById } = indexExam(exam);
  const more = questions.length > PAGE;
  const shown = questions.slice(0, PAGE);
  const link = (p) => `/library?${new URLSearchParams({ ...sp, page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Questions"
        subtitle={`${exam.code}`}
        actions={
          <>
            <a href="/library/export" className={buttonClass("secondary")}>
              Export approved
            </a>
            <LinkButton href="/library/import" variant="primary">
              Import
            </LinkButton>
          </>
        }
      />
      <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search text"
          aria-label="Search"
          className="md:col-span-2"
        />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="approved">Approved</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select name="objective" defaultValue={sp.objective ?? ""} aria-label="Objective">
          <option value="">Any objective</option>
          {exam.domains
            .flatMap((d) => d.objectives)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} {o.title.slice(0, 50)}
              </option>
            ))}
        </Select>
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="Type">
          <option value="">Any type</option>
          <option value="single">Single answer</option>
          <option value="multi">Multiple answer</option>
          <option value="tf">True / false</option>
        </Select>
        <Select name="origin" defaultValue={sp.origin ?? ""} aria-label="Origin">
          <option value="">Shared bank and mine</option>
          <option value="bank">Shared bank only</option>
          <option value="mine">My imports only</option>
        </Select>
        <CheckChip name="flagged" defaultChecked={sp.flagged === "1"}>Flagged only</CheckChip>
        <Button type="submit">Filter</Button>
      </form>

      {shown.length === 0 ? (
        <EmptyState title="No questions match">
          Import a file of questions, or loosen the filters.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-theme border border-line bg-surface">
          {shown.map((q) => {
            const ob = objectiveById.get(q.objectiveId);
            return (
              <li
                key={q.id}
                className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <Link
                  href={`/library/questions/${q.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  {q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem}
                </Link>
                <span className="text-xs text-muted">{ob?.code}</span>
                {q.fromBank && <Badge tone="info">bank</Badge>}
                <Badge tone="idle">{q.type}</Badge>
                <Badge
                  tone={
                    q.reviewStatus === "approved"
                      ? "ok"
                      : q.reviewStatus === "draft"
                        ? "info"
                        : "bad"
                  }
                >
                  {q.reviewStatus}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {page > 0 && (
          <Link className="text-accent underline" href={link(page - 1)}>
            Previous
          </Link>
        )}
        {more && (
          <Link className="text-accent underline" href={link(page + 1)}>
            Next
          </Link>
        )}
      </div>
    </>
  );
}
