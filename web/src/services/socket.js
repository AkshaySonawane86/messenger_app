


// src/services/socket.js
import { io } from "socket.io-client";
import useAuthStore from "../store/useAuthStore";

let socket = null;

export function createSocket(token, opts = {}) {
  // if token not passed, pick from store (useful when caller forgets to pass)
  if (!token) {
    token = useAuthStore.getState().token;
  }

  // if token is missing, don't attempt to connect (server expects auth)
  if (!token) {
    console.warn("⚠️ createSocket skipped: no token available");
    return null;
  }

  // reuse existing socket if still connected
  if (socket && socket.connected) return socket;

  const url = opts.url || import.meta.env.VITE_API_URL || "http://localhost:4000";

  socket = io(url, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err && err.message ? err.message : err);
  });

  socket.on("connect", () => {
    console.log("Socket connected", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  try {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  } catch (e) {
    console.warn("disconnectSocket error", e);
    socket = null;
  }
}
