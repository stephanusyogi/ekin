import type { Metadata } from "next";
import "./globals.css";
import ActionConfirmationProvider from "./components/ActionConfirmationProvider";
export const metadata: Metadata = { title: "e Kinerja", description: "Sistem pencatatan, pemantauan, dan evaluasi kinerja pegawai.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body><ActionConfirmationProvider>{children}</ActionConfirmationProvider></body></html>; }
