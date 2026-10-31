"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client.js";
import { Button, Field, Input } from "@/components/ui/index.js";

export function SignInForm({ devLogin }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function signInWithPasskey(autoFill = false) {
    setError(null);
    if (!autoFill) setBusy(true);
    const res = await authClient.signIn.passkey({ autoFill });
    if (!autoFill) setBusy(false);
    if (res?.error) {
      if (!autoFill) setError("Sign-in did not complete. Try again, or ask for a new link if you lost your passkeys.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  // Conditional UI: lets the browser offer saved passkeys in the username field.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (typeof PublicKeyCredential !== "undefined" && PublicKeyCredential.isConditionalMediationAvailable) {
      PublicKeyCredential.isConditionalMediationAvailable().then((ok) => ok && signInWithPasskey(true));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function devSignIn(e) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const res = await authClient.signIn.email({ email: data.get("email"), password: data.get("password") });
    if (res.error) return setError("Wrong email or password.");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Hidden-from-view field that gives the browser a place to offer passkey autofill. */}
      <input className="sr-only" aria-hidden="true" tabIndex={-1} autoComplete="username webauthn" />
      <Button variant="primary" className="w-full py-3" onPress={() => signInWithPasskey(false)} isDisabled={busy}>
        {busy ? "Waiting for your passkey…" : "Sign in with a passkey"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      {devLogin && (
        <form onSubmit={devSignIn} className="space-y-3 rounded-theme border border-dashed border-warn p-4">
          <p className="text-sm font-medium text-warn">Development only: password sign-in (localhost)</p>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" variant="secondary">
            Sign in (dev)
          </Button>
        </form>
      )}
    </div>
  );
}
