import mongoose from "mongoose";

const StatusItemSchema = new mongoose.Schema({
  type: { type: String, enum: ["text","image","video"], default: "image" },
  url: String,
  caption: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const StatusSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [StatusItemSchema],
  expiresAt: { type: Date, required: true }, // set TTL when creating
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// optionally add TTL index on expiresAt so Mongo deletes expired statuses automatically
StatusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Status", StatusSchema);
