import { lookupEnrollmentToken } from "@/lib/auth/index.js";
import { JoinForm } from "./JoinForm.js";

export const metadata = { title: "Join", robots: { index: false } };
// The link carries a secret: never cache this page or leak it in a referrer.
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }) {
  const { token } = await params;
  const invite = await lookupEnrollmentToken(token);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl">CertPrep</h1>
      {invite ? (
        <>
          <p className="mt-2 text-muted">
            {invite.purpose === "reset" ? "Welcome back" : "Welcome"}, <strong className="text-text">{invite.name}</strong>.{" "}
            {invite.purpose === "reset"
              ? "Your old passkeys were removed. Create a new one to get back in."
              : "Create a passkey to finish setting up your account."}{" "}
            It uses your device's fingerprint, face or PIN. There is no password.
          </p>
          <JoinForm token={token} />
        </>
      ) : (
        <p role="alert" className="mt-4 rounded-theme border border-bad bg-bad-soft p-4 text-sm text-bad">
          This link is invalid, has already been used, or has expired. Ask for a new one.
        </p>
      )}
    </main>
  );
}
