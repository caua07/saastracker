export default function Loading() {
  return (
    <main
      className="loading-page"
      aria-busy="true"
      aria-label="Carregando seu espaço"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-summary" />
      <div className="loading-columns">
        <div className="skeleton skeleton-list" />
        <div className="skeleton skeleton-agenda" />
      </div>
      <span className="sr-only">Carregando suas assinaturas.</span>
    </main>
  );
}
