// server/src/middleware/auth.js
import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "no_token_provided" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    const user = await User.findById(payload.userId).select("_id name email avatarUrl");
    if (!user) {
      return res.status(401).json({ ok: false, error: "user_not_found" });
    }

    req.user = { id: user._id.toString(), name: user.name, email: user.email };
    next();
  } catch (err) {
    console.error("❌ authMiddleware error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}
