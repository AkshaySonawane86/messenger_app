
// src/services/socket.js
import { io } from "socket.io-client";
import useAuthStore from "../store/useAuthStore";

let socket = null;

function dispatchWindowEvent(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (e) {
    const ev = document.createEvent("CustomEvent");
    ev.initCustomEvent(name, false, false, detail);
    window.dispatchEvent(ev);
  }
}

export function createSocket(token, opts = {}) {
  if (!token) token = useAuthStore.getState().token;
  if (!token) {
    console.warn("⚠️ createSocket skipped: no token available");
    return null;
  }

  if (socket && socket.connected) return socket;

  const url =
    opts.url || import.meta.env.VITE_API_URL || "http://localhost:4000";

  socket = io(url, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  /* -------------------------------------------------------------- */
  /* CONNECTION EVENTS                                              */
  /* -------------------------------------------------------------- */
  socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err?.message || err);
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
    dispatchWindowEvent("socket:connect", { socketId: socket.id });
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    dispatchWindowEvent("socket:disconnect", { reason });
  });

  /* -------------------------------------------------------------- */
  /* UNIFIED MESSAGE EVENT (PRIVATE + GROUP)                        */
  /* backend ALWAYS emits "message:new" now                         */
  /* -------------------------------------------------------------- */
  socket.on("message:new", (msg) => {
    dispatchWindowEvent("socket:message:new", msg);
  });

  /* -------------------------------------------------------------- */
  /* MESSAGE STATUS UPDATES                                         */
  /* -------------------------------------------------------------- */
  socket.on("message:update", (payload) => {
    dispatchWindowEvent("socket:message:update", payload);
  });

  /* -------------------------------------------------------------- */
  /* TYPING (PRIVATE)                                               */
  /* -------------------------------------------------------------- */
  socket.on("typing:update", (payload) => {
    dispatchWindowEvent("socket:typing:update", payload);
  });

  /* -------------------------------------------------------------- */
  /* GROUP TYPING (if used)                                         */
  /* -------------------------------------------------------------- */
  socket.on("group:typing", (payload) => {
    dispatchWindowEvent("socket:group:typing", payload);
  });

  /* -------------------------------------------------------------- */
  /* PRESENCE UPDATES                                               */
  /* -------------------------------------------------------------- */
  socket.on("presence:update", (payload) => {
    dispatchWindowEvent("socket:presence:update", payload);
  });

  /* -------------------------------------------------------------- */
  /* GROUP JOIN/LEAVE (optional UI hooks)                           */
  /* -------------------------------------------------------------- */
  socket.on("group:joined", (payload) => {
    dispatchWindowEvent("socket:group:joined", payload);
  });

  socket.on("group:left", (payload) => {
    dispatchWindowEvent("socket:group:left", payload);
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
