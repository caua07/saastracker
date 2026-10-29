"use client";
import { BrandMark } from "@/components/brand";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <BrandMark />
      <h1>Não conseguimos abrir seu espaço.</h1>
      <p>
        Confira a conexão e a configuração do banco. Nenhum dado será
        substituído por causa deste erro.
      </p>
      <button className="button button-primary" onClick={reset}>
        Tentar novamente
      </button>
      <Link href="/login">Voltar para o acesso</Link>
    </main>
  );
}
