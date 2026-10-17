import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/feedback/toast";
import "leaflet/dist/leaflet.css";
import "./globals.css";
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "ResQLink | Human-led rescue coordination",
    template: "%s | ResQLink",
  },
  description:
    "Connecting urgent needs with coordinated rescue response. A decision-support prototype, not a live emergency service.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
