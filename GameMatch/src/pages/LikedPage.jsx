import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/shared/EmptyState";
import { useAppContext } from "../app/AppProvider";
import { fetchPreferredGameUrl, fetchTrailerUrl } from "../services/rawg";
import { formatRating } from "../utils/formatters";

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function resolveSummary(game) {
  if (Array.isArray(game.genres) && game.genres.length) {
    return game.genres.join(" • ");
  }

  return game.shortDesc || "Sem resumo salvo.";
}

export function LikedPage() {
  const { likedGames, notify, removeLikedGame } = useAppContext();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredGames = useMemo(() => {
    if (!deferredSearch) {
      return likedGames;
    }

    return likedGames.filter((game) => {
      const haystack = `${game.name} ${game.shortDesc} ${(game.genres || []).join(" ")}`.toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [likedGames, deferredSearch]);

  async function openTrailer(game) {
    try {
      const url = await fetchTrailerUrl(game.id, game.name);
      openExternal(url);
    } catch {
      notify({
        title: "Trailer não encontrado",
        description: "Vamos abrir a busca no YouTube.",
        tone: "warning",
      });
      openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.name} trailer`)}`);
    }
  }

  async function openGame(game) {
    try {
      const url = await fetchPreferredGameUrl(game.id, game.name);
      openExternal(url);
    } catch {
      openExternal(`https://rawg.io/search?query=${encodeURIComponent(game.name)}`);
    }
  }

  async function handleRemove(game) {
    await removeLikedGame(game.id);
    notify({
      title: "Curtida removida",
      description: `${game.name} saiu da sua biblioteca.`,
      tone: "neutral",
    });
  }

  return (
    <div className="stack-page">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curtidos</p>
            <h3>Sua biblioteca pessoal de favoritos.</h3>
          </div>
        </div>

        <div className="discover-toolbar">
          <label className="field field--compact field--search">
            <span>Buscar na biblioteca</span>
            <input
              placeholder="Procure por nome, gênero ou resumo"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <article className="stat-card stat-card--inline">
            <strong>{likedGames.length}</strong>
            <span>Jogos salvos</span>
          </article>

          <article className="stat-card stat-card--inline">
            <strong>{filteredGames.length}</strong>
            <span>Resultados atuais</span>
          </article>
        </div>
      </section>

      {filteredGames.length ? (
        <section className="liked-grid">
          {filteredGames.map((game) => (
            <article className="liked-card" key={game.id}>
              <div className="liked-card__media">
                {game.cover ? <img alt={`Capa de ${game.name}`} src={game.cover} /> : <span aria-hidden="true" />}
              </div>

              <div className="liked-card__body">
                <div className="liked-card__header">
                  <div className="liked-card__title-row">
                    <h4>{game.name}</h4>
                    <span className="liked-card__rating" aria-label={`Nota ${formatRating(game.rating)}`}>
                      {formatRating(game.rating)}
                    </span>
                  </div>
                  <p>{resolveSummary(game)}</p>
                </div>

                <div className="liked-card__actions">
                  <button className="button button--ghost" type="button" onClick={() => openGame(game)}>
                    Página do jogo
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => openTrailer(game)}>
                    Trailer
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => handleRemove(game)}>
                    Remover
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="Sem favoritos"
          title="Sua biblioteca ainda está vazia."
          description="Curta alguns jogos na descoberta para montar sua lista."
          action={
            <Link className="button button--primary" to="/discover">
              Ir para descoberta
            </Link>
          }
        />
      )}
    </div>
  );
}
