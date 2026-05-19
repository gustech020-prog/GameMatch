export function LoaderScreen({ label = "Carregando..." }) {
  return (
    <div className="loader-screen">
      <div className="loader-screen__panel">
        <span className="loader-screen__spinner" />
        <p className="loader-screen__label">{label}</p>
      </div>
    </div>
  );
}
