import { getAppContext, getTheme, THEMES } from "@/lib/app/context.js";
import { setThemeAction } from "@/app/actions/exam.js";
import { Button, Card, PageHeader } from "@/components/ui/index.js";
import { AccountSecurity } from "./AccountSecurity.js";
import { DataCard } from "./DataCard.js";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }) {
  const sp = await searchParams;
  const { user } = await getAppContext();
  const theme = await getTheme();

  return (
    <>
      <PageHeader title="Account" subtitle={user.name} />
      <div className="grid gap-4">
        <AccountSecurity welcome={sp.welcome === "1"} />
        <DataCard userName={user.name} error={sp.error} />
        <Card title="Appearance">
          <form action={setThemeAction} className="grid gap-2">
            {THEMES.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-theme border border-line p-3 text-sm">
                <input type="radio" name="theme" value={t.id} defaultChecked={t.id === theme} className="mt-1" />
                <span><span className="font-medium">{t.name}</span> <span className="text-muted">{t.note}</span></span>
              </label>
            ))}
            <div><Button type="submit">Use this theme</Button></div>
          </form>
          <p className="mt-2 text-xs text-muted">Light or dark follows your device setting.</p>
        </Card>
      </div>
    </>
  );
}
