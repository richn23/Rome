import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotificationListener from "@/components/NotificationListener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpeakSpace",
  description: "Practice speaking with native speakers",
};

// Sets the theme class before first paint to avoid a flash of the wrong theme
const noFlashScript = `
  (function() {
    try {
      var s = localStorage.getItem('ss-theme');
      var d = (s === 'dark') || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (d) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
        <ThemeProvider>
          <AuthProvider>
            <NotificationListener />
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
