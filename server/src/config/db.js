


import mongoose from "mongoose";

export default async function connectDB(uri) {
  if (!uri) throw new Error("DB URI missing");
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("✅ MongoDB connected");
}
