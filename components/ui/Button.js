"use client";
import { Button as AriaButton } from "react-aria-components";
import { buttonClass } from "./styles.js";

/** Wraps React Aria's Button (keyboard, focus and press handling) with the app's look. */
export function Button({ variant = "secondary", className = "", ...props }) {
  return <AriaButton className={buttonClass(variant, className)} {...props} />;
}
