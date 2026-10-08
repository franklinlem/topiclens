import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "TopicLens AI - Agrupamento Semântico e Descoberta de Tópicos",
  description: "Plataforma de Inteligência de Tópicos e Agrupamento Semântico Não-Supervisionado com UMAP, HDBSCAN e LLMs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
            <p>TopicLens AI © 2026 • Agrupamento Semântico não-supervisionado com UMAP, HDBSCAN e LiteLLM</p>
          </footer>
        </div>
      </body>
    </html>
  );
}

