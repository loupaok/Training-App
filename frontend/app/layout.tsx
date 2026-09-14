import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Coach Management App",
  description: "Coaching business platform for coaches and clients",
};

const ACCENT_INIT_SCRIPT = `(function(){try{var a=localStorage.getItem("accentColor");if(a&&a!=="red")document.documentElement.setAttribute("data-accent",a);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
