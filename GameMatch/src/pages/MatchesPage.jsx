import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MatchCard } from "../components/matches/MatchCard";
import { EmptyState } from "../components/shared/EmptyState";
import { useAppContext } from "../app/AppProvider";
import { fetchPreferredGameUrl } from "../services/rawg";
import { subscribeToRoomMatches, subscribeToUserMatchHistory } from "../services/rooms";
import { groupHistoryByRoom } from "../utils/formatters";

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function MatchesPage() {
  const { room, roomMembers, user } = useAppContext();
  const [roomMatches, setRoomMatches] = useState([]);
  const [historyMatches, setHistoryMatches] = useState([]);
  const [expandedRooms, setExpandedRooms] = useState({});

  useEffect(() => subscribeToRoomMatches(room?.id, setRoomMatches, () => setRoomMatches([])), [room?.id]);
  useEffect(() => subscribeToUserMatchHistory(user?.uid, setHistoryMatches, () => setHistoryMatches([])), [user?.uid]);

  const folders = groupHistoryByRoom(historyMatches);

  async function openGame(item) {
    const url = await fetchPreferredGameUrl(item.gameId, item.gameName);
    openExternal(url);
  }

  return (
    <div className="stack-page">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Matches</p>
            <h3>Os jogos que deram certo para a sala.</h3>
          </div>
        </div>

        <div className="stat-grid">
          <article className="stat-card">
            <strong>{roomMatches.length}</strong>
            <span>Matches na sala atual</span>
          </article>
          <article className="stat-card">
            <strong>{historyMatches.length}</strong>
            <span>Matches no histórico</span>
          </article>
          <article className="stat-card">
            <strong>{roomMembers.length}</strong>
            <span>Membros conectados agora</span>
          </article>
        </div>
      </section>

      <div className="content-split">
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sala ativa</p>
              <h3>{room?.id ? `Sala ${room.id}` : "Nenhuma sala selecionada"}</h3>
            </div>
          </div>

          {roomMatches.length ? (
            <div className="match-list">
              {roomMatches.map((item) => (
                <MatchCard item={item} key={item.id} onOpenGame={openGame} />
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Sem match ainda"
              title="A sala ainda não encontrou um jogo em comum."
              description="Quando duas ou mais pessoas curtirem o mesmo jogo, ele aparece aqui."
              action={
                <Link className="button button--primary" to={room?.id ? "/discover" : "/rooms"}>
                  {room?.id ? "Voltar ao deck" : "Entrar em uma sala"}
                </Link>
              }
            />
          )}
        </section>

        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Histórico</p>
              <h3>Pastas por sala.</h3>
            </div>
          </div>

          {folders.length ? (
            <div className="history-stack">
              {folders.map((folder) => {
                const expanded = Boolean(expandedRooms[folder.key]);
                return (
                  <article className="history-folder" key={folder.key}>
                    <button
                      className="history-folder__header"
                      onClick={() =>
                        setExpandedRooms((current) => ({
                          ...current,
                          [folder.key]: !current[folder.key],
                        }))
                      }
                      type="button"
                    >
                      <div>
                        <strong>{folder.title}</strong>
                        <p>{folder.items.length} match(es) guardados</p>
                      </div>
                      <span className="tag">{expanded ? "Ocultar" : "Abrir"}</span>
                    </button>

                    {expanded ? (
                      <div className="match-list">
                        {folder.items.map((item) => (
                          <MatchCard item={item} key={item.id} onOpenGame={openGame} />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="Histórico vazio"
              title="Nenhum match salvo ainda."
              description="Os jogos em comum ficam guardados aqui automaticamente."
            />
          )}
        </section>
      </div>
    </div>
  );
}
