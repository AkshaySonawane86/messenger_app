import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import "./loadEnv.js"; // 👈 must be the first line
import { initSocket } from "./sockets/index.js";

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

(async () => {
  await connectDB(process.env.DB_URI);
  initSocket(server);
  server.listen(PORT, () => console.log(`Server running on ${PORT}`));
})();
