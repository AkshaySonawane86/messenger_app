import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema({
  identifier: { type: String, required: true, index: true }, // email (lowercased)
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Otp", OtpSchema);
