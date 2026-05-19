export function MatchCard({ item, onOpenGame }) {
  return (
    <article className="match-card">
      <div className="match-card__cover">
        {item.gameCover ? <img alt={`Capa de ${item.gameName}`} src={item.gameCover} /> : <span>Sem capa</span>}
      </div>

      <div className="match-card__body">
        <h4>{item.gameName || "Jogo"}</h4>
        <p>{Array.isArray(item.likedByNames) && item.likedByNames.length ? item.likedByNames.join(", ") : "Match salvo"}</p>
      </div>

      <button className="button button--ghost" type="button" onClick={() => onOpenGame(item)}>
        Página do jogo
      </button>
    </article>
  );
}
