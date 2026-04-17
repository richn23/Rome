import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <AuthProvider>
          <NotificationListener />
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
