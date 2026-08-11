import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magical Potion Academy — Brew Legendary Potions",
  description:
    "A cozy magical potion academy where you walk the castle, enter the alchemy lab, and brew 12 legendary potions. Inspired by fantasy RPGs.",
  keywords: ["magic", "potion", "game", "educational", "fantasy", "alchemy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600&family=IM+Fell+English:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
