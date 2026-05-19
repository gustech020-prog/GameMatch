import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { GameDeck } from "../components/deck/GameDeck";
import { EmptyState } from "../components/shared/EmptyState";
import { LoaderScreen } from "../components/shared/LoaderScreen";
import { useAppContext } from "../app/AppProvider";
import { castVote } from "../services/rooms";
import { fetchGames, fetchPreferredGameUrl, fetchTrailerUrl } from "../services/rawg";
import { pluralize } from "../utils/formatters";

const genreOptions = [
  { value: "all", label: "Tudo" },
  { value: "action", label: "Ação" },
  { value: "indie", label: "Indie" },
  { value: "adventure", label: "Aventura" },
  { value: "rpg", label: "RPG" },
  { value: "strategy", label: "Estratégia" },
  { value: "shooter", label: "Tiro" },
];

const orderingOptions = [
  { value: "-added", label: "Mais populares" },
  { value: "-rating", label: "Melhor avaliados" },
  { value: "-released", label: "Lançamentos" },
  { value: "-metacritic", label: "Metacritic" },
];

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function filterLikedGames(items, likedIdSet, extraBlockedIds = []) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const blockedIds = new Set(extraBlockedIds.map((item) => String(item)));
  return items.filter((item) => {
    const id = String(item?.id || "");
    return id && !likedIdSet.has(id) && !blockedIds.has(id);
  });
}

export function DiscoverPage() {
  const {
    addLikedGame,
    deckRefreshToken,
    isLiked,
    likedGames,
    notify,
    preferences,
    room,
    roomInfo,
    roomMembers,
    updatePreferences,
    user,
  } = useAppContext();

  const [games, setGames] = useState([]);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [ordering, setOrdering] = useState("-added");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeckLocked, setIsDeckLocked] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const gamesRef = useRef([]);
  const indexRef = useRef(0);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const loadingMorePromiseRef = useRef(null);
  const voteLockRef = useRef(false);
  const catalogBasePageRef = useRef(Math.floor(Math.random() * 18) + 1);
  const likedIdSetRef = useRef(new Set());
  const likedIdSet = useMemo(() => new Set(likedGames.map((item) => String(item.id))), [likedGames]);

  const currentGame = games[index];
  const nextGame = games[index + 1];

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    likedIdSetRef.current = likedIdSet;
  }, [likedIdSet]);

  const notifyLoadError = useEffectEvent(() => {
    notify({
      title: "Falha ao carregar jogos",
      description: "Não foi possível atualizar a lista agora.",
      tone: "danger",
    });
  });

  async function collectDeckGames({ startPage, minCount, maxAttempts, blockedIds = [] }) {
    const collected = [];
    const knownIds = new Set(blockedIds.map((item) => String(item)));
    let pageCursor = startPage;

    for (let attempt = 0; attempt < maxAttempts && collected.length < minCount; attempt += 1) {
      const batch = await fetchGames({
        allowAdult: preferences.allowAdult,
        page: pageCursor,
        search: deferredQuery,
        genre,
        ordering,
        basePage: catalogBasePageRef.current,
      });

      const validItems = filterLikedGames(batch, likedIdSetRef.current, [...knownIds]);
      validItems.forEach((item) => {
        const id = String(item.id);
        if (knownIds.has(id)) {
          return;
        }

        knownIds.add(id);
        collected.push(item);
      });

      pageCursor += 1;
    }

    return {
      items: collected,
      lastPage: Math.max(startPage, pageCursor - 1),
    };
  }

  const loadMoreIfNeeded = useEffectEvent(async (nextIndex, force = false) => {
    const currentGames = gamesRef.current;

    if (loadingMoreRef.current) {
      return loadingMorePromiseRef.current;
    }

    if (!force && nextIndex < currentGames.length - 6) {
      return currentGames;
    }

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    const loadingPromise = (async () => {
      try {
        const { items, lastPage } = await collectDeckGames({
          startPage: pageRef.current + 1,
          minCount: 10,
          maxAttempts: 6,
          blockedIds: currentGames.map((item) => item.id),
        });

        if (items.length) {
          setGames((current) => {
            const knownIds = new Set(current.map((item) => String(item.id)));
            const appended = items.filter((item) => !knownIds.has(String(item.id)));
            const merged = [...current, ...appended];
            gamesRef.current = merged;
            return merged;
          });
        }

        pageRef.current = lastPage;
        setPage(lastPage);
        return gamesRef.current;
      } catch {
        return gamesRef.current;
      } finally {
        loadingMoreRef.current = false;
        loadingMorePromiseRef.current = null;
        setIsLoadingMore(false);
      }
    })();

    loadingMorePromiseRef.current = loadingPromise;
    return loadingPromise;
  });

  useEffect(() => {
    let active = true;

    async function loadInitialDeck() {
      setIsLoading(true);
      setIsDeckLocked(false);
      setGames([]);
      setIndex(0);
      setPage(1);
      gamesRef.current = [];
      indexRef.current = 0;
      pageRef.current = 1;
      loadingMoreRef.current = false;
      loadingMorePromiseRef.current = null;
      voteLockRef.current = false;
      catalogBasePageRef.current = deferredQuery ? 1 : Math.floor(Math.random() * 18) + 1;
      setIsLoadingMore(false);

      try {
        const { items, lastPage } = await collectDeckGames({
          startPage: 1,
          minCount: 14,
          maxAttempts: 8,
        });

        if (active) {
          setGames(items);
          gamesRef.current = items;
          pageRef.current = lastPage;
          setPage(lastPage);
        }
      } catch {
        if (active) {
          setGames([]);
          notifyLoadError();
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadInitialDeck, deferredQuery ? 180 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [preferences.allowAdult, deferredQuery, genre, ordering, deckRefreshToken]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let nextIndex = indexRef.current;
    let shouldRefill = false;

    setGames((current) => {
      if (!current.length) {
        shouldRefill = true;
        return current;
      }

      const filtered = current.filter((item) => !likedIdSet.has(String(item.id)));
      if (filtered.length !== current.length) {
        const removedBeforeCurrent = current
          .slice(0, nextIndex)
          .filter((item) => likedIdSet.has(String(item.id))).length;

        nextIndex = Math.max(0, nextIndex - removedBeforeCurrent);
        if (nextIndex >= filtered.length) {
          nextIndex = Math.max(0, filtered.length - 1);
        }

        gamesRef.current = filtered;
        shouldRefill = filtered.length < 6;
        return filtered;
      }

      shouldRefill = filtered.length < 6;
      return current;
    });

    if (nextIndex !== indexRef.current) {
      indexRef.current = nextIndex;
      setIndex(nextIndex);
    }

    if (shouldRefill) {
      void loadMoreIfNeeded(nextIndex, true);
    }
  }, [likedIdSet, isLoading, loadMoreIfNeeded]);

  const persistVote = useEffectEvent(async (game, direction) => {
    try {
      if (direction === "like" && !isLiked(game.id)) {
        await addLikedGame(game);
        notify({
          title: "Jogo curtido",
          description: `${game.name} foi salvo nos seus curtidos.`,
          tone: "success",
        });
      }

      if (room?.id) {
        await castVote({
          roomId: room.id,
          user,
          game,
          action: direction,
        });
      }
    } catch {
      notify({
        title: "Não foi possível registrar seu voto",
        description: "Tente novamente em alguns segundos.",
        tone: "danger",
      });
    }
  });

  const handleVote = useEffectEvent(async (direction) => {
    if (voteLockRef.current || isLoading) {
      return;
    }

    voteLockRef.current = true;
    setIsDeckLocked(true);

    const currentIndex = indexRef.current;
    let currentGames = gamesRef.current;
    const game = currentGames[currentIndex];

    if (!game) {
      voteLockRef.current = false;
      setIsDeckLocked(false);
      return;
    }

    try {
      const nextIndex = currentIndex + 1;

      if (!currentGames[nextIndex]) {
        await loadMoreIfNeeded(currentIndex, true);
        currentGames = gamesRef.current;
      }

      if (!currentGames[nextIndex]) {
        void loadMoreIfNeeded(currentIndex, true);
        return;
      }

      indexRef.current = nextIndex;
      setIndex(nextIndex);
      void loadMoreIfNeeded(nextIndex);
      void persistVote(game, direction);
    } finally {
      voteLockRef.current = false;
      setIsDeckLocked(false);
    }
  });

  const voteWithKeyboard = useEffectEvent((direction) => {
    if (!gamesRef.current[indexRef.current] || isLoading) {
      return;
    }

    handleVote(direction);
  });

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowRight") {
        voteWithKeyboard("like");
      }

      if (event.key === "ArrowLeft") {
        voteWithKeyboard("pass");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [voteWithKeyboard]);

  async function openTrailer(game) {
    try {
      const trailerUrl = await fetchTrailerUrl(game.id, game.name);
      openExternal(trailerUrl);
    } catch {
      notify({
        title: "Trailer indisponível",
        description: "Vamos abrir a busca do YouTube.",
        tone: "warning",
      });
      openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.name} trailer`)}`);
    }
  }

  async function openStore(game) {
    try {
      const url = await fetchPreferredGameUrl(game.id, game.name);
      openExternal(url);
    } catch {
      openExternal(`https://rawg.io/search?query=${encodeURIComponent(game.name)}`);
    }
  }

  if (isLoading) {
    return <LoaderScreen label="Carregando jogos..." />;
  }

  return (
    <div className="page-grid page-grid--discover">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Descoberta</p>
            <h3>Encontre um jogo para a próxima rodada.</h3>
          </div>
        </div>

        <div className="discover-toolbar">
          <label className="field field--compact field--search">
            <span>Buscar</span>
            <input
              placeholder="Busque por nome ou gênero"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="field field--compact">
            <span>Ordenar por</span>
            <select value={ordering} onChange={(event) => setOrdering(event.target.value)}>
              {orderingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toggle-card">
            <div>
              <strong>Conteúdo adulto</strong>
              <p>{preferences.allowAdult ? "Mostrando o catálogo completo." : "Filtro seguro ativado."}</p>
            </div>
            <button
              aria-pressed={preferences.allowAdult}
              className={`toggle${preferences.allowAdult ? " is-active" : ""}`}
              onClick={() => updatePreferences({ allowAdult: !preferences.allowAdult })}
              type="button"
            >
              <span />
            </button>
          </label>
        </div>

        <div className="chip-row">
          {genreOptions.map((option) => (
            <button
              className={`chip${genre === option.value ? " is-active" : ""}`}
              key={option.value}
              onClick={() => setGenre(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="page-grid__main">
        {currentGame ? (
          <GameDeck
            currentGame={currentGame}
            isBusy={isDeckLocked || (isLoadingMore && !nextGame)}
            nextGame={nextGame}
            onLike={() => handleVote("like")}
            onOpenStore={() => openStore(currentGame)}
            onOpenTrailer={() => openTrailer(currentGame)}
            onPass={() => handleVote("pass")}
          />
        ) : isLoadingMore ? (
          <LoaderScreen label="Buscando mais jogos..." />
        ) : (
          <EmptyState
            eyebrow="Deck vazio"
            title="Não encontramos jogos com esse filtro."
            description="Tente trocar o gênero, liberar mais catálogo ou mudar a busca."
          />
        )}

        {isLoadingMore ? <p className="surface-note">Carregando mais jogos...</p> : null}
      </section>

      <aside className="page-grid__rail">
        <section className="surface">
          <p className="eyebrow">Resumo</p>
          <div className="stat-grid">
            <article className="stat-card">
              <strong>{likedGames.length}</strong>
              <span>Curtidos salvos</span>
            </article>
            <article className="stat-card">
              <strong>{roomMembers.length}</strong>
              <span>{pluralize(roomMembers.length, "membro na sala", "membros na sala")}</span>
            </article>
            <article className="stat-card">
              <strong>{roomInfo?.maxMembers || "-"}</strong>
              <span>Capacidade da sala</span>
            </article>
          </div>
        </section>

        <section className="surface">
          <p className="eyebrow">Próximo jogo</p>
          {nextGame ? (
            <div className="queue-card">
              <strong>{nextGame.name}</strong>
              <p>{nextGame.shortDesc || "Sem resumo."}</p>
            </div>
          ) : (
            <p className="muted">Sem prévia disponível no momento.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
