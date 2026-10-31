import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/index.js";
import { devPasswordLoginEnabled } from "@/lib/auth/config.js";
import { SignInForm } from "./SignInForm.js";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl">CertPrep</h1>
      <p className="mt-2 text-muted">Sign in with your passkey. Access is by invitation.</p>
      <SignInForm devLogin={devPasswordLoginEnabled(process.env)} />
    </main>
  );
}
