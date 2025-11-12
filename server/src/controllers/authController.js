


import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import dotenv from "dotenv";
import Otp from "../models/Otp.js";
import User from "../models/User.js";
import { sendOtpEmail } from "../utils/email.js";
import { signToken } from "../utils/jwt.js";

dotenv.config();

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const OTP_TTL_MIN = Number(process.env.OTP_TTL_MIN || 10);
const OTP_RATE_LIMIT_COUNT = Number(process.env.OTP_RATE_LIMIT_COUNT || 5);

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ ok: false, error: "email_required" });

    const identifier = String(email).trim().toLowerCase();

    const oneHourAgo = dayjs().subtract(1, "hour").toDate();
    const recentCount = await Otp.countDocuments({
      identifier,
      createdAt: { $gte: oneHourAgo },
    });
    if (recentCount >= OTP_RATE_LIMIT_COUNT)
      return res.status(429).json({ ok: false, error: "rate_limited" });

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = dayjs().add(OTP_TTL_MIN, "minute").toDate();

    await Otp.create({ identifier, codeHash, expiresAt });
    await sendOtpEmail(identifier, code);

    return res.json({ ok: true, message: "otp_sent" });
  } catch (err) {
    console.error("requestOtp error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

export async function verifyOtp(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res
        .status(400)
        .json({ ok: false, error: "email_and_code_required" });

    const identifier = String(email).trim().toLowerCase();

    const now = new Date();
    const otpDoc = await Otp.findOne({
      identifier,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    if (!otpDoc)
      return res
        .status(400)
        .json({ ok: false, error: "otp_not_found_or_expired" });

    if (otpDoc.attempts >= 5) {
      await Otp.deleteMany({ identifier });
      return res.status(429).json({ ok: false, error: "too_many_attempts" });
    }

    const matches = await bcrypt.compare(String(code), otpDoc.codeHash);
    if (!matches) {
      otpDoc.attempts = (otpDoc.attempts || 0) + 1;
      await otpDoc.save();
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }

    let user = await User.findOne({ email: identifier });
    if (!user) {
      user = await User.create({
        email: identifier,
        name: "",
        createdAt: new Date(),
      });
    }

    await Otp.deleteMany({ identifier });

    const token = signToken({ userId: user._id.toString() }, { expiresIn: "30d" });

    return res.json({
      ok: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("verifyOtp error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

// ✅ Fixed Upload Avatar Controller
export async function uploadAvatar(req, res) {
  try {
    const { userId } = req.body;
    if (!userId)
      return res.status(401).json({ ok: false, error: "unauthorized" });

    if (!req.file)
      return res.status(400).json({ ok: false, error: "no_file_uploaded" });

    const avatarRelativePath = `/uploads/avatars/${req.file.filename}`;
    const avatarFullUrl = `${BASE_URL}${avatarRelativePath}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl: avatarFullUrl },
      { new: true }
    ).lean();

    if (!user)
      return res.status(404).json({ ok: false, error: "user_not_found" });

    return res.json({ ok: true, avatarUrl: avatarFullUrl, user });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
