import { getAppContext, getTheme, THEMES } from "@/lib/app/context.js";
import { setStudyPrefsAction, setThemeAction } from "@/app/actions/exam.js";
import { withUser } from "@/lib/db/index.js";
import { getPrefs } from "@/lib/db/prefs.js";
import { Button, Card, checkClass, optionCardClass, PageHeader } from "@/components/ui/index.js";
import { AccountSecurity } from "./AccountSecurity.js";
import { DataCard } from "./DataCard.js";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }) {
  const sp = await searchParams;
  const { user } = await getAppContext();
  const theme = await getTheme();
  const prefs = await withUser(user.id, getPrefs);

  return (
    <>
      <PageHeader title="Account" subtitle={user.name} />
      <div className="grid gap-4">
        <AccountSecurity welcome={sp.welcome === "1"} />
        <DataCard userName={user.name} error={sp.error} />
        <Card title="Appearance">
          <form action={setThemeAction} className="grid gap-2">
            {THEMES.map((t) => (
              <label key={t.id} className={optionCardClass}>
                <input type="radio" name="theme" value={t.id} defaultChecked={t.id === theme} className={`mt-0.5 ${checkClass}`} />
                <span><span className="font-medium">{t.name}</span> <span className="text-muted">{t.note}</span></span>
              </label>
            ))}
            <div><Button type="submit">Use this theme</Button></div>
          </form>
          <p className="mt-2 text-xs text-muted">Light or dark follows your device setting. Saved with your account.</p>
        </Card>
        <Card title="Practice">
          <form action={setStudyPrefsAction} className="grid gap-3 text-sm">
            <label className={optionCardClass}>
              <input type="checkbox" name="showConfidence" defaultChecked={prefs.showConfidence} className={`mt-0.5 ${checkClass}`} />
              <span>
                <span className="font-medium">Ask how sure I am before checking an answer</span>
                <span className="block text-muted">Guess, unsure or sure. Shown again in the answer review, so lucky guesses stand out.</span>
              </span>
            </label>
            <div><Button type="submit">Save</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
