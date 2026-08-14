import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "What If — Enter the Academy",
  description:
    "A magical adventure game. Enter the Academy, choose your path, and discover what lies within.",
  keywords: ["magic", "wizard", "game", "fantasy", "adventure", "academy"],
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
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600;900&family=IM+Fell+English:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
