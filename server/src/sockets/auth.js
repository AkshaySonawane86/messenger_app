import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

export async function socketAuthMiddleware(socket, next) {
  // Expect token in socket.handshake.auth.token or as first arg during 'auth:login'.
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error("Authentication error - token missing"));
  }
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return next(new Error("Authentication error - invalid token"));
  }

  // Optionally fetch user and attach to socket
  const user = await User.findById(payload.userId).select("_id name avatarUrl");
  if (!user) return next(new Error("Authentication error - user not found"));

  socket.user = { id: user._id.toString(), name: user.name };
  return next();
}
