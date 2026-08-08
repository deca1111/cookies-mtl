import type { Metadata } from "next";
import localFont from "next/font/local";
import { Comfortaa } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
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
