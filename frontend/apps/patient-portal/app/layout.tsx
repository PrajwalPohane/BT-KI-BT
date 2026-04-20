import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "BlockMedShare Patient Portal",
  description: "Manage consent and view your medical access history"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
