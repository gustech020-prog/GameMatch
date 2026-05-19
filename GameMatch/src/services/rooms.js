import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { normalizeRoomId } from "../utils/validators";

function createRoomId(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

async function upsertNicknameProfile(user, nickname) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      nickname,
      email: user.email || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createRoom({ user, nickname, maxMembers }) {
  if (!user?.uid) {
    throw new Error("Você precisa estar autenticado para criar uma sala.");
  }

  const roomId = createRoomId();
  const roomRef = doc(db, "rooms", roomId);
  const memberRef = doc(db, "rooms", roomId, "members", user.uid);

  await setDoc(roomRef, {
    createdBy: user.uid,
    createdByEmail: user.email || null,
    createdAt: serverTimestamp(),
    maxMembers,
    memberCount: 1,
  });

  await setDoc(memberRef, {
    joined: true,
    joinedAt: serverTimestamp(),
    nickname,
    email: user.email || null,
    role: "host",
  });

  await upsertNicknameProfile(user, nickname);
  return roomId;
}

export async function joinRoom({ roomId, user, nickname }) {
  if (!user?.uid) {
    throw new Error("Você precisa estar autenticado para entrar em uma sala.");
  }

  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    throw new Error("Informe um código de sala válido.");
  }

  const roomRef = doc(db, "rooms", normalizedRoomId);
  const memberRef = doc(db, "rooms", normalizedRoomId, "members", user.uid);

  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);

    if (!roomSnapshot.exists()) {
      throw new Error("Sala não encontrada.");
    }

    const roomData = roomSnapshot.data() || {};
    const maxMembers = Number(roomData.maxMembers || 0);
    const memberCount = Number(roomData.memberCount || 0);
    const memberSnapshot = await transaction.get(memberRef);

    if (!memberSnapshot.exists() && maxMembers && memberCount >= maxMembers) {
      throw new Error("Esta sala já está lotada.");
    }

    transaction.set(
      memberRef,
      {
        joined: true,
        joinedAt: serverTimestamp(),
        nickname,
        email: user.email || null,
      },
      { merge: true }
    );

    if (!memberSnapshot.exists()) {
      transaction.update(roomRef, {
        memberCount: memberCount + 1,
      });
    }
  });

  await upsertNicknameProfile(user, nickname);
  return normalizedRoomId;
}

export async function leaveRoom({ roomId, userId }) {
  if (!roomId || !userId) {
    return;
  }

  const roomRef = doc(db, "rooms", roomId);
  const memberRef = doc(db, "rooms", roomId, "members", userId);

  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      return;
    }

    const memberSnapshot = await transaction.get(memberRef);
    const roomData = roomSnapshot.data() || {};
    const memberCount = Number(roomData.memberCount || 0);

    if (memberSnapshot.exists()) {
      transaction.delete(memberRef);
    }

    transaction.update(roomRef, {
      memberCount: Math.max(0, memberCount - (memberSnapshot.exists() ? 1 : 0)),
    });
  });
}

async function persistMatchHistory({ roomId, game, likedBy }) {
  const membersSnapshot = await getDocs(collection(db, "rooms", roomId, "members"));
  const nicknameByUid = {};

  membersSnapshot.forEach((memberDoc) => {
    const memberData = memberDoc.data() || {};
    nicknameByUid[memberDoc.id] =
      String(memberData.nickname || "").trim() ||
      String(memberData.email || "").split("@")[0] ||
      "jogador";
  });

  const likedByNames = likedBy.map((uid) => nicknameByUid[uid] || `user-${uid.slice(0, 6)}`);
  const matchRef = doc(db, "rooms", roomId, "matches", String(game.id));

  await setDoc(
    matchRef,
    {
      gameId: String(game.id),
      gameName: game.name,
      gameCover: game.cover || "",
      likedBy,
      likedByNames,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all(
    likedBy.map((memberUid) =>
      setDoc(
        doc(db, "users", memberUid, "matchHistory", `${roomId}_${game.id}`),
        {
          roomId,
          gameId: String(game.id),
          gameName: game.name,
          gameCover: game.cover || "",
          likedBy,
          likedByNames,
          matchedWith: likedBy.filter((uid) => uid !== memberUid),
          folderName: `Sala ${roomId}`,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function castVote({ roomId, user, game, action }) {
  if (!roomId || !user?.uid || !game?.id) {
    return;
  }

  const voteRef = doc(db, "rooms", roomId, "votes", String(game.id));

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(voteRef);
    const currentData = snapshot.exists()
      ? snapshot.data()
      : {
          likedBy: [],
          passedBy: [],
        };

    const likedBy = Array.isArray(currentData.likedBy) ? currentData.likedBy : [];
    const passedBy = Array.isArray(currentData.passedBy) ? currentData.passedBy : [];
    const uid = user.uid;
    let nextLikedBy = likedBy;
    let nextPassedBy = passedBy;

    if (action === "like") {
      if (!likedBy.includes(uid)) {
        nextLikedBy = [...likedBy, uid];
      }

      if (passedBy.includes(uid)) {
        nextPassedBy = passedBy.filter((entry) => entry !== uid);
      }
    } else {
      if (!passedBy.includes(uid)) {
        nextPassedBy = [...passedBy, uid];
      }

      if (likedBy.includes(uid)) {
        nextLikedBy = likedBy.filter((entry) => entry !== uid);
      }
    }

    transaction.set(
      voteRef,
      {
        gameId: String(game.id),
        gameName: game.name,
        gameCover: game.cover || "",
        likedBy: nextLikedBy,
        passedBy: nextPassedBy,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      likedBy: nextLikedBy,
    };
  });

  if (action === "like" && result.likedBy.length >= 2) {
    await persistMatchHistory({
      roomId,
      game,
      likedBy: result.likedBy,
    });
  }
}

export function subscribeToRoomMatches(roomId, onValue, onError) {
  if (!roomId) {
    onValue([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "rooms", roomId, "matches"),
    (snapshot) => {
      const data = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
      onValue(data);
    },
    onError
  );
}

export function subscribeToUserMatchHistory(userId, onValue, onError) {
  if (!userId) {
    onValue([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "users", userId, "matchHistory"),
    (snapshot) => {
      const data = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
      onValue(data);
    },
    onError
  );
}

export async function getRoomSnapshot(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "rooms", normalizedRoomId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
