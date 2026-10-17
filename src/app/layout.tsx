import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Blinka PayGuard | Prototipo",
  description: "Prototipo de revisión de facturas y decisiones trazables para Hackathon 30X.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
