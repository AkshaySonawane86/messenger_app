
// server/src/models/User.js
import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: String,
    socketId: String,
    lastSeen: Date,
    userAgent: String,
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    phone: { type: String, index: true, sparse: true },
    email: {
      type: String,
      index: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    about: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    devices: [DeviceSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/**
 * Virtual: displayName — fallback for empty names
 */
UserSchema.virtual("displayName").get(function () {
  return this.name || this.email || "Unnamed User";
});

export default mongoose.model("User", UserSchema);
