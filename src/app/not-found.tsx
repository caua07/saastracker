import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>Esse caminho não faz parte do seu espaço.</h1>
      <Link className="button button-primary" href="/">
        Voltar à visão geral
      </Link>
    </main>
  );
}
