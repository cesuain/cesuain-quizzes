import type { Metadata } from "next";
import { Toaster } from "@cesuain/ui";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/anton/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Interview Quizzes", template: "%s · Interview Quizzes" },
  description:
    "Interview prep quizzes for React, TypeScript, JavaScript, Next.js, GitHub, Shopify and more, with XP, achievements and custom practice.",
};

// Applies the saved theme before first paint. Dark is the design system default.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
