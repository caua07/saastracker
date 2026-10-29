import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Saastemics — seu stack, sob controle",
    template: "%s · Saastemics",
  },
  description:
    "Seu espaço pessoal para organizar assinaturas, entender custos e acompanhar as próximas cobranças.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FC",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
