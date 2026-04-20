import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "BlockMedShare Hospital Portal",
  description: "Submit and track cross-institution data requests"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
