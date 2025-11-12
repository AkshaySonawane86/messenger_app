

// server/src/routes/authRoutes.js
import express from "express";
import { requestOtp, uploadAvatar, verifyOtp } from "../controllers/authController.js";
import upload from "../middleware/upload.js";
import User from "../models/User.js";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/upload-avatar", upload.single("avatar"), uploadAvatar);

router.get("/users", async (req, res) => {
  try {
    const excludeId = req.query.excludeId;
    const filter = excludeId ? { _id: { $ne: excludeId } } : {};
    const users = await User.find(filter, "_id name email avatarUrl devices").lean();

    const formatted = users.map((u) => {
      const devices = u.devices || [];
      const online = devices.some((d) => !!d.socketId);
      const lastSeenDates = devices
        .map((d) => d.lastSeen)
        .filter(Boolean)
        .map((d) => new Date(d));
      const lastSeen =
        lastSeenDates.length > 0
          ? new Date(Math.max(...lastSeenDates.map((d) => d.getTime())))
          : null;

      return {
        _id: u._id,
        name: u.name?.trim() || u.email,
        email: u.email,
        avatarUrl: u.avatarUrl,
        online,
        lastSeen,
      };
    });

    res.json({ ok: true, users: formatted });
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
