import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppContext } from "../app/AppProvider";
import { RoomMemberList } from "../components/rooms/RoomMemberList";
import { createRoom, getRoomSnapshot, joinRoom, leaveRoom } from "../services/rooms";
import { buildRoomInviteUrl } from "../utils/formatters";
import { fallbackNickname, normalizeRoomId } from "../utils/validators";

export function RoomsPage() {
  const params = useParams();
  const inviteRoomId = normalizeRoomId(params.roomId);
  const {
    notify,
    profile,
    room,
    roomInfo,
    roomMembers,
    saveProfile,
    setActiveRoom,
    user,
  } = useAppContext();

  const [nickname, setNickname] = useState(profile.nickname || fallbackNickname(user?.email));
  const [createCapacity, setCreateCapacity] = useState("4");
  const [joinCode, setJoinCode] = useState(inviteRoomId || "");
  const [inviteRoomInfo, setInviteRoomInfo] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    setNickname((current) => current || profile.nickname || fallbackNickname(user?.email));
  }, [profile.nickname, user?.email]);

  useEffect(() => {
    if (inviteRoomId) {
      setJoinCode(inviteRoomId);
    }
  }, [inviteRoomId]);

  useEffect(() => {
    let active = true;

    async function loadInviteInfo() {
      if (!inviteRoomId) {
        setInviteRoomInfo(null);
        return;
      }

      const snapshot = await getRoomSnapshot(inviteRoomId);
      if (active) {
        setInviteRoomInfo(snapshot);
      }
    }

    loadInviteInfo().catch(() => {
      if (active) {
        setInviteRoomInfo(null);
      }
    });

    return () => {
      active = false;
    };
  }, [inviteRoomId]);

  async function handleSaveNickname() {
    try {
      setIsWorking(true);
      await saveProfile(nickname);
      notify({
        title: "Apelido salvo",
        description: "Seu nome já está pronto para aparecer nas salas.",
        tone: "success",
      });
    } catch (error) {
      notify({
        title: "Não foi possível salvar",
        description: error?.message || "Tente novamente em alguns segundos.",
        tone: "danger",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateRoom() {
    const maxMembers = Number(createCapacity);
    const trimmedNickname = String(nickname || "").trim();

    if (!trimmedNickname) {
      notify({
        title: "Apelido obrigatório",
        description: "Salve um apelido antes de criar a sala.",
        tone: "warning",
      });
      return;
    }

    if (!Number.isFinite(maxMembers) || maxMembers < 2 || maxMembers > 10) {
      notify({
        title: "Capacidade inválida",
        description: "Escolha um número entre 2 e 10 pessoas.",
        tone: "warning",
      });
      return;
    }

    try {
      setIsWorking(true);
      const roomId = await createRoom({
        user,
        nickname: trimmedNickname,
        maxMembers,
      });
      setActiveRoom(roomId);
      setJoinCode(roomId);
      notify({
        title: "Sala criada",
        description: `A sala ${roomId} está pronta para receber convidados.`,
        tone: "success",
      });
    } catch (error) {
      notify({
        title: "Falha ao criar sala",
        description: error?.message || "Não foi possível criar a sala agora.",
        tone: "danger",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleJoinRoom() {
    const trimmedNickname = String(nickname || "").trim();
    if (!trimmedNickname) {
      notify({
        title: "Apelido obrigatório",
        description: "Salve um apelido antes de entrar em uma sala.",
        tone: "warning",
      });
      return;
    }

    try {
      setIsWorking(true);
      const roomId = await joinRoom({
        roomId: joinCode,
        user,
        nickname: trimmedNickname,
      });
      setActiveRoom(roomId);
      notify({
        title: "Entrada confirmada",
        description: `Você entrou na sala ${roomId}.`,
        tone: "success",
      });
    } catch (error) {
      notify({
        title: "Não foi possível entrar",
        description: error?.message || "Revise o código e tente novamente.",
        tone: "danger",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleLeaveRoom() {
    try {
      setIsWorking(true);
      await leaveRoom({
        roomId: room?.id,
        userId: user?.uid,
      });
      setActiveRoom("");
      notify({
        title: "Você saiu da sala",
        description: "A rodada em grupo foi encerrada neste navegador.",
        tone: "neutral",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleShareRoom() {
    const inviteUrl = buildRoomInviteUrl(room?.id);
    const message = `Entra na minha sala do GameMatch: ${room?.id}\n${inviteUrl}`;

    if (navigator.share) {
      await navigator.share({
        title: "Convite GameMatch",
        text: message,
      });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    } else {
      window.prompt("Copie o convite abaixo:", message);
    }

    notify({
      title: "Convite copiado",
      description: "O link da sala já está na sua área de transferência.",
      tone: "success",
    });
  }

  return (
    <div className="stack-page">
      <div className="content-split content-split--compact">
        <section className="surface room-profile-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Perfil</p>
              <h3>Como seu nome aparece nas salas.</h3>
            </div>
          </div>

          <div className="room-profile-panel__form">
            <label className="field">
              <span>Apelido</span>
              <input
                maxLength={24}
                placeholder="Ex: JoãoGamer"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>
            <button className="button button--primary" disabled={isWorking} onClick={handleSaveNickname} type="button">
              Salvar apelido
            </button>
          </div>
        </section>

        {inviteRoomId && !room?.id ? (
          <section className="surface room-invite-card">
            <p className="eyebrow">Convite</p>
            <h3>Sala {inviteRoomId}</h3>
            <p className="muted">
              {inviteRoomInfo
                ? `${inviteRoomInfo.memberCount || 0} membro(s) conectados • capacidade ${inviteRoomInfo.maxMembers || "-"}`
                : "Buscando informações da sala compartilhada..."}
            </p>
            <button className="button button--secondary" disabled={isWorking} onClick={handleJoinRoom} type="button">
              Entrar na sala
            </button>
          </section>
        ) : null}
      </div>

      {room?.id ? (
        <div className="content-split">
          <section className="surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sala ativa</p>
                <h3>{room.id}</h3>
              </div>
              <span className="tag tag--accent">
                {roomInfo?.memberCount || roomMembers.length}/{roomInfo?.maxMembers || "-"} membros
              </span>
            </div>

            <div className="room-actions">
              <button className="button button--primary" disabled={isWorking} onClick={handleShareRoom} type="button">
                Compartilhar convite
              </button>
              <button className="button button--secondary" disabled={isWorking} onClick={handleLeaveRoom} type="button">
                Sair da sala
              </button>
            </div>

            <div className="room-code-panel">
              <p className="eyebrow">Link rápido</p>
              <strong>{buildRoomInviteUrl(room.id)}</strong>
            </div>
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Membros</p>
                <h3>Quem está jogando esta rodada.</h3>
              </div>
            </div>

            <RoomMemberList hostId={roomInfo?.createdBy} currentUserId={user?.uid} members={roomMembers} />
          </section>
        </div>
      ) : (
        <div className="content-split">
          <section className="surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Criar sala</p>
                <h3>Monte uma rodada privada.</h3>
              </div>
            </div>

            <label className="field">
              <span>Capacidade</span>
              <input
                inputMode="numeric"
                maxLength={2}
                placeholder="4"
                value={createCapacity}
                onChange={(event) => setCreateCapacity(event.target.value)}
              />
            </label>

            <button className="button button--primary" disabled={isWorking} onClick={handleCreateRoom} type="button">
              Criar nova sala
            </button>
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Entrar em sala</p>
                <h3>Use um código ou abra um convite.</h3>
              </div>
            </div>

            <label className="field">
              <span>Código da sala</span>
              <input
                maxLength={8}
                placeholder="AB12CD"
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeRoomId(event.target.value))}
              />
            </label>

            <button className="button button--secondary" disabled={isWorking} onClick={handleJoinRoom} type="button">
              Entrar agora
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
