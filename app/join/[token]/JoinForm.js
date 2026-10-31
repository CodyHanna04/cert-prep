"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client.js";
import { Button } from "@/components/ui/index.js";

export function JoinForm({ token }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setError(null);
    setBusy(true);
    const res = await authClient.passkey.addPasskey({
      context: token,
      name: "First passkey",
      createSession: true,
    });
    setBusy(false);
    if (res?.error) {
      setError(res.error.message || "Could not create the passkey. The link may have been used already.");
      return;
    }
    // Next: add a second passkey so losing one device is not a lockout.
    router.replace("/account?welcome=1");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      <Button variant="primary" className="w-full py-3" onPress={create} isDisabled={busy}>
        {busy ? "Waiting for your device…" : "Create my passkey"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
