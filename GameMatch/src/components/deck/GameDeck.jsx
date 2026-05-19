import { useSwipeDeck } from "../../hooks/useSwipeDeck";
import { formatDate, formatRating } from "../../utils/formatters";
import { LinkIcon, PlayIcon } from "../shared/Icons";

export function GameDeck({
  currentGame,
  nextGame,
  onPass,
  onLike,
  onOpenTrailer,
  onOpenStore,
  isBusy,
}) {
  const { drag, likeStrength, passStrength, handlePointerDown, triggerSwipe } = useSwipeDeck({
    onVote: (direction) => {
      if (direction === "like") {
        onLike();
        return;
      }

      onPass();
    },
    disabled: isBusy || !currentGame,
  });

  if (!currentGame) {
    return null;
  }

  const rotation = Math.max(-12, Math.min(12, drag.x / 24));
  const transform = {
    transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg)`,
    transition:
      drag.phase === "dragging"
        ? "none"
        : drag.phase === "exit"
          ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "transform 180ms cubic-bezier(0.16, 0.84, 0.28, 1)",
  };

  return (
    <section className="deck">
      <div className="deck__stage">
        {nextGame ? (
          <article key={`ghost_${nextGame.id}`} className="game-card game-card--ghost" aria-hidden="true">
            <div className="game-card__media">
              {nextGame.cover ? <img alt="" key={nextGame.cover} src={nextGame.cover} /> : <div className="game-card__placeholder" />}
            </div>
          </article>
        ) : null}

        <article
          key={currentGame.id}
          className="game-card"
          onPointerDown={handlePointerDown}
          role="button"
          style={transform}
          tabIndex={0}
        >
          <div className="game-card__vote game-card__vote--like" style={{ opacity: Math.min(1, likeStrength) }}>
            Curtir
          </div>
          <div className="game-card__vote game-card__vote--pass" style={{ opacity: Math.min(1, passStrength) }}>
            Passar
          </div>

          <div className="game-card__media">
            {currentGame.cover ? (
              <img alt={`Capa de ${currentGame.name}`} key={currentGame.cover} src={currentGame.cover} />
            ) : (
              <div className="game-card__placeholder">
                <span>Sem capa</span>
              </div>
            )}
            <div className="game-card__gloss" />
          </div>

          <div className="game-card__body">
            <div className="game-card__meta">
              <span className="tag">{currentGame.esrb || "Sem ESRB"}</span>
              <span className="tag tag--accent">Nota {formatRating(currentGame.rating)}</span>
              {currentGame.releaseDate ? <span className="tag">{formatDate(currentGame.releaseDate)}</span> : null}
            </div>

            <div className="game-card__header">
              <div>
                <h3>{currentGame.name}</h3>
                <p>{currentGame.shortDesc || "Sem resumo disponível."}</p>
              </div>
            </div>

            <div className="game-card__footer">
              <dl className="game-card__facts">
                <div>
                  <dt>Gêneros</dt>
                  <dd>{currentGame.genres?.length ? currentGame.genres.join(", ") : "Não informado"}</dd>
                </div>
                <div>
                  <dt>Plataformas</dt>
                  <dd>{currentGame.platforms?.length ? currentGame.platforms.join(", ") : "Não informado"}</dd>
                </div>
              </dl>

              <div className="game-card__actions-panel">
                <div className="game-card__links">
                  <button className="button button--ghost" type="button" onClick={onOpenStore}>
                    <LinkIcon />
                    <span>Página do jogo</span>
                  </button>
                  <button className="button button--ghost" type="button" onClick={onOpenTrailer}>
                    <PlayIcon />
                    <span>Ver trailer</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="game-card__vote-actions game-card__vote-actions--wide">
              <button className="button button--secondary" type="button" onClick={() => triggerSwipe("pass")}>
                Passar
              </button>
              <button className="button button--primary" type="button" onClick={() => triggerSwipe("like")}>
                Curtir
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
