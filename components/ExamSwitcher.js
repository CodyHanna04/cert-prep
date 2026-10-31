"use client";
import { setActiveExamAction } from "@/app/actions/exam.js";

export function ExamSwitcher({ exams, activeId }) {
  if (exams.length === 0) return null;
  return (
    <form action={setActiveExamAction}>
      <label className="sr-only" htmlFor="exam-switcher">
        Active exam
      </label>
      <select
        id="exam-switcher"
        name="examId"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form.requestSubmit()}
        className="rounded-theme border border-line bg-surface px-2 py-1.5 text-sm"
      >
        {exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.code}
          </option>
        ))}
      </select>
    </form>
  );
}
