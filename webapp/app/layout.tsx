import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/AuthContext";
import { AuthButton } from "../components/AuthButton";

export const metadata: Metadata = {
  title: "GT Magic Eye",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="app-header">
            <span className="app-title">GT Magic Eye</span>
            <AuthButton />
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
