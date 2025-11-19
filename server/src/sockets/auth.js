


// server/src/sockets/auth.js
import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * socketAuthMiddleware
 * - Accepts token from socket.handshake.auth.token (preferred) or socket.handshake.query.token (fallback)
 * - Verifies token and fetches user from DB
 * - Attaches a normalized `socket.user` object for downstream socket handlers
 * - Returns next() or an auth error
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    // token may come from handshake.auth (recommended) or handshake.query (legacy)
    const token =
      socket.handshake?.auth?.token ||
      socket.handshake?.query?.token ||
      null;

    if (!token) {
      return next(new Error("Authentication error - token missing"));
    }

    // verifyToken can be sync or async depending on your utils — handle both safely
    const payload = await Promise.resolve(verifyToken(token));
    if (!payload || !payload.userId) {
      return next(new Error("Authentication error - invalid token"));
    }

    // Fetch authenticated user (lean to keep object simple)
    const user = await User.findById(payload.userId)
      .select("_id name email avatarUrl devices")
      .lean();

    if (!user) {
      return next(new Error("Authentication error - user not found"));
    }

    // Attach normalized user info to socket
    socket.user = {
      id: String(user._id),
      name: user.name || "",
      email: user.email || "",
      avatarUrl: user.avatarUrl || "",
      // devices may be used by presence logic elsewhere
      devices: user.devices || [],
    };

    return next();
  } catch (err) {
    console.error("❌ Socket auth error:", err);
    // don't leak internals to client; return a generic auth error
    return next(new Error("Authentication error"));
  }
}
