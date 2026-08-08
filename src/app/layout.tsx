import type { Metadata } from "next";
import localFont from "next/font/local";
import { Comfortaa } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";

// Titres et marque : la Gill Sans Ultra Bold fournie par Léo (licence perso, self-host).
const gillSans = localFont({
  src: "../fonts/gill-sans-ultra-bold.otf",
  variable: "--font-title",
  weight: "700",
  display: "swap",
});

const comfortaa = Comfortaa({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"
  ),
  title: "Cookies MTL",
  description: "La carte des cookies de Montréal · Montreal's cookie map",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${gillSans.variable} ${comfortaa.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
