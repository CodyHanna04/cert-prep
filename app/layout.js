import "./globals.css";
import { getTheme } from "@/lib/app/context.js";

export const metadata = {
  title: { default: "CertPrep", template: "%s · CertPrep" },
  description: "Study for certification exams against the vendor's published blueprint.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">{children}</body>
    </html>
  );
}
