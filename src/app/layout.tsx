import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Check — IT Support",
  description: "Catatan kerja harian dan follow-up tugas IT Support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
