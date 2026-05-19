const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY || "592276ea591744618a985db8340298c2";
const BASE_URL = "https://api.rawg.io/api";
const REQUEST_TIMEOUT_MS = 12000;

const FALLBACK_GAMES = [
  {
    id: "fallback-hades",
    name: "Hades",
    cover: "",
    rating: 4.6,
    esrb: "Teen",
    genres: ["Roguelike", "Action"],
    platforms: ["PC", "Nintendo Switch", "PlayStation"],
    releaseDate: "2020-09-17",
    shortDesc: "Roguelike veloz, combate refinado e runs perfeitas para maratonas curtas.",
  },
  {
    id: "fallback-persona",
    name: "Persona 5 Royal",
    cover: "",
    rating: 4.8,
    esrb: "Mature",
    genres: ["JRPG", "Adventure"],
    platforms: ["PC", "Xbox", "PlayStation", "Switch"],
    releaseDate: "2019-10-31",
    shortDesc: "Estilo absoluto, narrativa longa e um loop social que sempre prende.",
  },
  {
    id: "fallback-stardew",
    name: "Stardew Valley",
    cover: "",
    rating: 4.7,
    esrb: "Everyone 10+",
    genres: ["Simulation", "Indie"],
    platforms: ["PC", "Mobile", "Console"],
    releaseDate: "2016-02-26",
    shortDesc: "Cozy, social e perfeito para grupos que querem algo leve sem perder profundidade.",
  },
  {
    id: "fallback-hollow",
    name: "Hollow Knight",
    cover: "",
    rating: 4.7,
    esrb: "Everyone 10+",
    genres: ["Metroidvania", "Indie"],
    platforms: ["PC", "Switch", "PlayStation", "Xbox"],
    releaseDate: "2017-02-24",
    shortDesc: "Exploração elegante, trilha forte e combate preciso em um mundo denso.",
  },
  {
    id: "fallback-forza",
    name: "Forza Horizon 5",
    cover: "",
    rating: 4.5,
    esrb: "Everyone",
    genres: ["Racing", "Open World"],
    platforms: ["PC", "Xbox"],
    releaseDate: "2021-11-09",
    shortDesc: "Corrida expansiva, visual bonito e uma energia perfeita para jogar em grupo.",
  },
];

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("key", RAWG_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function fetchJsonWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function shuffle(items) {
  const list = [...items];

  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }

  return list;
}

function isAdultEsrb(esrbName) {
  const normalized = String(esrbName || "").toLowerCase();
  return normalized.includes("mature") || normalized.includes("adults only") || normalized === "ao";
}

function isAdultMetadata(game) {
  const tags = Array.isArray(game?.tags)
    ? game.tags.map((tag) => String(tag?.slug || tag?.name || "").toLowerCase())
    : [];
  const genres = Array.isArray(game?.genres)
    ? game.genres.map((genre) => String(genre?.slug || genre?.name || "").toLowerCase())
    : [];
  const text = `${game?.name || ""} ${game?.slug || ""} ${tags.join(" ")} ${genres.join(" ")}`.toLowerCase();
  const adultSignals = ["adult", "nsfw", "sexual", "nudity", "ecchi", "hentai", "porn", "erotic"];

  return adultSignals.some((term) => text.includes(term));
}

function mapRawgGame(game) {
  const genres = Array.isArray(game?.genres) ? game.genres.map((genre) => genre.name).slice(0, 3) : [];
  const platforms = Array.isArray(game?.parent_platforms)
    ? game.parent_platforms.map((entry) => entry.platform?.name).filter(Boolean).slice(0, 4)
    : [];

  return {
    id: String(game.id),
    name: game.name || "Jogo sem nome",
    cover: game.background_image || "",
    rating: Number(game.rating || 0),
    esrb: game.esrb_rating?.name || null,
    genres,
    platforms,
    releaseDate: game.released || "",
    shortDesc: [genres.join(" • "), game.rating ? `Nota ${game.rating.toFixed(1)}` : "", game.released ? `Lançado em ${game.released}` : ""]
      .filter(Boolean)
      .join(" | "),
  };
}

export async function fetchGames({
  allowAdult = false,
  page = 1,
  search = "",
  genre = "all",
  ordering = "-added",
  basePage,
  pageSize = 18,
}) {
  const safeBasePage = Number.isFinite(basePage) ? Math.max(1, Math.floor(basePage)) : Math.floor(Math.random() * 18) + 1;
  const effectivePage = search ? page : safeBasePage + page - 1;
  const params = {
    page: effectivePage,
    page_size: pageSize,
    ordering,
  };

  if (search) {
    params.search = search;
    params.search_precise = true;
  }

  if (genre && genre !== "all") {
    params.genres = genre;
  }

  try {
    const data = await fetchJsonWithTimeout(buildUrl("/games", params));
    const items = Array.isArray(data?.results) ? data.results : [];
    const safeItems = allowAdult
      ? items
      : items.filter((game) => !isAdultEsrb(game?.esrb_rating?.name) && !isAdultMetadata(game));

    return shuffle(safeItems.map(mapRawgGame));
  } catch {
    const safeItems = allowAdult
      ? FALLBACK_GAMES
      : FALLBACK_GAMES.filter((game) => !isAdultEsrb(game.esrb));
    return shuffle(safeItems);
  }
}

export async function fetchTrailerUrl(gameId, gameName = "") {
  const [moviesData, detailsData] = await Promise.all([
    fetchJsonWithTimeout(buildUrl(`/games/${gameId}/movies`)),
    fetchJsonWithTimeout(buildUrl(`/games/${gameId}`)),
  ]);

  const firstMovie = Array.isArray(moviesData?.results) ? moviesData.results[0] : null;
  const directVideo =
    firstMovie?.data?.max || firstMovie?.data?.["480"] || firstMovie?.data?.["320"] || detailsData?.clip?.clip || "";

  if (directVideo) {
    return directVideo;
  }

  if (firstMovie?.external_id) {
    return `https://www.youtube.com/watch?v=${firstMovie.external_id}`;
  }

  const query = encodeURIComponent(`${gameName || detailsData?.name || "game"} trailer`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export async function fetchPreferredGameUrl(gameId, gameName = "") {
  const [detailsData, storesData] = await Promise.all([
    fetchJsonWithTimeout(buildUrl(`/games/${gameId}`)),
    fetchJsonWithTimeout(buildUrl(`/games/${gameId}/stores`)),
  ]);

  const stores = Array.isArray(storesData?.results) ? storesData.results : [];
  const withUrl = stores.filter((store) => typeof store?.url === "string" && store.url.length > 0);
  const steamStore =
    withUrl.find((store) => store?.store?.slug === "steam") ||
    withUrl.find((store) => store.url.includes("steampowered.com"));

  if (steamStore?.url) {
    return steamStore.url;
  }

  if (withUrl[0]?.url) {
    return withUrl[0].url;
  }

  if (detailsData?.website) {
    return detailsData.website;
  }

  const fallbackSlug =
    detailsData?.slug || String(gameName || "").trim().toLowerCase().replace(/\s+/g, "-");

  return fallbackSlug ? `https://rawg.io/games/${fallbackSlug}` : "https://rawg.io";
}
