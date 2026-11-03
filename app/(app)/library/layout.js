import { LibraryTabs } from "@/components/LibraryTabs.js";

export default function LibraryLayout({ children }) {
  return (
    <>
      <LibraryTabs />
      {children}
    </>
  );
}
