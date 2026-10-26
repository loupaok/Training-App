import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SP Team",
  description: "Πλατφόρμα coaching SP Team",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="el" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
