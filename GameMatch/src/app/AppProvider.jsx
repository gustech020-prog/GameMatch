import { createContext, startTransition, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { usePersistentState } from "../hooks/usePersistentState";
import { auth, db, ensureAuthPersistence } from "../lib/firebase";
import { fallbackNickname, normalizeRoomId } from "../utils/validators";

const AppContext = createContext(null);

const defaultPreferences = {
  allowAdult: false,
  theme: "midnight",
};

export function AppProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ nickname: "", email: "" });
  const [likedGames, setLikedGames] = useState([]);
  const [deckRefreshToken, setDeckRefreshToken] = useState(0);
  const [roomId, setRoomId] = usePersistentState("gm_active_room_v2", "");
  const [preferences, setPreferences] = usePersistentState("gm_preferences_v2", defaultPreferences);
  const [roomInfo, setRoomInfo] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    ensureAuthPersistence().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      startTransition(() => {
        setUser(nextUser ?? null);
        setAuthReady(true);
      });

      if (!nextUser) {
        setProfile({ nickname: "", email: "" });
        setLikedGames([]);
        setRoomInfo(null);
        setRoomMembers([]);
        setRoomId("");
      }
    });

    return unsubscribe;
  }, [setRoomId]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme || "midnight";
  }, [preferences.theme]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data() || {};
        setProfile({
          nickname: String(data.nickname || fallbackNickname(user.email)).slice(0, 24),
          email: user.email || "",
        });
      },
      () => {
        setProfile({
          nickname: fallbackNickname(user.email),
          email: user.email || "",
        });
      }
    );

    return unsubscribe;
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const likedQuery = query(collection(db, "users", user.uid, "likedGames"), orderBy("likedAt", "desc"));
    const unsubscribe = onSnapshot(
      likedQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }));
        setLikedGames(nextItems);
      },
      () => {
        setLikedGames([]);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!roomId) {
      setRoomInfo(null);
      setRoomMembers([]);
      return undefined;
    }

    const roomRef = doc(db, "rooms", roomId);
    const membersRef = collection(db, "rooms", roomId, "members");

    const unsubscribeRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        setRoomInfo(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      },
      () => {
        setRoomInfo(null);
      }
    );

    const unsubscribeMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        const members = snapshot.docs
          .map((entry) => ({
            id: entry.id,
            ...entry.data(),
          }))
          .sort((left, right) => {
            const leftStamp = left.joinedAt?.seconds || left.updatedAt?.seconds || 0;
            const rightStamp = right.joinedAt?.seconds || right.updatedAt?.seconds || 0;
            return leftStamp - rightStamp;
          });
        setRoomMembers(members);
      },
      () => {
        setRoomMembers([]);
      }
    );

    return () => {
      unsubscribeRoom();
      unsubscribeMembers();
    };
  }, [roomId]);

  function notify({ title, description = "", tone = "neutral" }) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, title, description, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }

  async function saveProfile(nicknameInput) {
    if (!user?.uid) {
      return;
    }

    const nickname = String(nicknameInput || "").trim().slice(0, 24);
    if (!nickname) {
      throw new Error("Defina um apelido para continuar.");
    }

    await setDoc(
      doc(db, "users", user.uid),
      {
        nickname,
        email: user.email || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (roomId) {
      await setDoc(
        doc(db, "rooms", roomId, "members", user.uid),
        {
          nickname,
          email: user.email || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  async function addLikedGame(game) {
    if (!user?.uid || !game?.id) {
      return;
    }

    const payload = {
      id: String(game.id),
      name: game.name || "",
      cover: game.cover || "",
      shortDesc: game.shortDesc || "",
      genres: Array.isArray(game.genres) ? game.genres : [],
      releaseDate: game.releaseDate || "",
      esrb: game.esrb || null,
      rating: Number(game.rating || 0),
      likedAt: Date.now(),
      updatedAt: serverTimestamp(),
    };

    setLikedGames((current) => {
      if (current.some((item) => String(item.id) === String(game.id))) {
        return current;
      }

      return [payload, ...current];
    });

    await setDoc(doc(db, "users", user.uid, "likedGames", String(game.id)), payload, { merge: true });
  }

  async function removeLikedGame(gameId) {
    if (!user?.uid || !gameId) {
      return;
    }

    setLikedGames((current) => current.filter((item) => String(item.id) !== String(gameId)));
    await deleteDoc(doc(db, "users", user.uid, "likedGames", String(gameId)));
    setDeckRefreshToken(Date.now());
  }

  async function logout() {
    setRoomId("");
    await signOut(auth);
  }

  function setActiveRoom(nextRoomId) {
    setRoomId(normalizeRoomId(nextRoomId));
  }

  function updatePreferences(partial) {
    setPreferences((current) => ({
      ...current,
      ...partial,
    }));
  }

  function toggleTheme() {
    setPreferences((current) => ({
      ...current,
      theme: current.theme === "midnight" ? "daybreak" : "midnight",
    }));
  }

  const value = {
    authReady,
    user,
    profile,
    likedGames,
    deckRefreshToken,
    room: roomId ? { id: roomId } : null,
    roomInfo,
    roomMembers,
    preferences,
    toasts,
    notify,
    addLikedGame,
    removeLikedGame,
    saveProfile,
    logout,
    setActiveRoom,
    updatePreferences,
    toggleTheme,
    isLiked: (gameId) => likedGames.some((item) => String(item.id) === String(gameId)),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider.");
  }

  return context;
}
