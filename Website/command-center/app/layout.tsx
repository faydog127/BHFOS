import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Re-Group Command Center",
  description: "Dashboard scaffolding (read-only v1)"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <nav className="nav" aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/prs">Pull Requests</Link>
            <Link href="/re-group">Re-Group Docs</Link>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
