"use client";
import { useState } from "react";
import { Button } from "@/components/ui/index.js";

/** Copies `text` to the clipboard. Falls back to selecting the matching textarea if the clipboard is blocked. */
export function CopyButton({ text, label = "Copy" }) {
  const [state, setState] = useState("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <Button type="button" variant="primary" onPress={copy}>
      {state === "copied" ? "Copied" : state === "failed" ? "Select the text and copy it" : label}
    </Button>
  );
}
