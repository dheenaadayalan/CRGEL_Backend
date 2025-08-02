import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Database/config.js";
import orderRouter from "./Routes/orderRoutes.js";
import authRouter from "./Routes/authRoutes.js";
import qrCodeRouter from "./Routes/qrCodeRoutes.js";
import hrRouter from "./Routes/hrRoutes.js";
import cron from "node-cron";
import DigestFetch from "digest-fetch";
import rfidRouter from "./Routes/rfidRoutes.js";
import http from "http";
import { Server } from "socket.io";
import { addNewTray } from "./Controllers/rfidAddControllers.js";
import swRouter from "./Routes/swRoutes.js";

dotenv.config();

const digestClient = new DigestFetch(
  process.env.ATLAS_PUBLIC_KEY,
  process.env.ATLAS_PRIVATE_KEY,
  { algorithm: "MD5" }
);
const atlasBaseUrl = `https://cloud.mongodb.com/api/atlas/v1.0/groups/${process.env.ATLAS_PROJECT_ID}/clusters/${process.env.ATLAS_CLUSTER_NAME}`;

/**
 * Pause or resume the Atlas cluster.
 * @param {boolean} pause — true to pause, false to resume
 */
async function toggleCluster(pause) {
  try {
    const res = await digestClient.fetch(atlasBaseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: pause ? "true" : "false" }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    console.log(`Atlas cluster ${pause ? "paused" : "resumed"} successfully.`);
  } catch (err) {
    console.error("Error toggling Atlas cluster:", err);
  }
}

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true });

const devices = new Map();

app.use(
  cors({
    origin: "*",
    methods: ["POST", "GET", "PUT", "DELETE"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.status(200).send("Hi welcome to CRGEL API");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal Server Error",
  });
});

app.use("/api", orderRouter);
app.use("/api", authRouter);
app.use("/api", qrCodeRouter);
app.use("/api", hrRouter);
app.use("/api/rfid", rfidRouter);
app.use("/api/sw", swRouter);
connectDB();

io.on("connection", (socket) => {
  console.log("WS connected", socket.id);

  // Registration—accept string or object
  socket.on("register", (data) => {
    let payload = data;
    if (typeof data === "string") {
      try {
        payload = JSON.parse(data);
      } catch (e) {
        console.error("Invalid JSON in register:", e);
        return;
      }
    }
    const { deviceId } = payload;
    if (deviceId) {
      devices.set(deviceId, socket);
      console.log("Registered device", deviceId);
    }
  });

  //  ESP emits "garment_scan" with { rfidTag, targetId }
  socket.on("garment_scan", (data) => {
    let payload = data;
    if (typeof data === "string") {
      try {
        payload = JSON.parse(data);
      } catch (e) {
        console.error("Invalid JSON in garment_scan:", e);
        return;
      }
    }

    const { rfidTag, styleNumber, targetId } = payload;
    if (!rfidTag || !targetId) {
      console.warn("garment_scan missing rfidTag or targetId; ignoring");
      return;
    }
    console.log(
      `garment_scan received: rfidTag="${rfidTag}", targetId="${targetId}"`
    );

    const tabletSocket = devices.get(targetId);
    if (!tabletSocket) {
      console.warn(`No socket found for targetId="${targetId}"`);
      return;
    }

    // Forward just the RFID to the tablet
    tabletSocket.emit(
      "garment_scanned",
      JSON.stringify({ rfidTag: rfidTag.toUpperCase(),styleNumber: styleNumber })
    );
    console.log(`Forwarded garment_scanned → ${targetId}: "${rfidTag}"`);
  });

  // Incoming batches from e.g. admin → re-emit to device
  socket.on("new_batch", (msg) => {
    const target = devices.get(msg.deviceId);
    if (target) {
      target.emit("new_batch", msg);
    }
  });

  // Tray creation from device
  socket.on("new_tray", async (data) => {
    try {
      // If data is a string, parse it
      const trayData = typeof data === "string" ? JSON.parse(data) : data;
      const req = { body: trayData };
      const res = {
        status: (code) => ({
          json: (payload) => {
            socket.emit("tray_created", payload);
          },
        }),
      };
      await addNewTray(req, res);
    } catch (err) {
      console.error("addNewTray error", err);
      socket.emit("error", {
        message: "Failed to create tray",
        detail: err.message,
      });
    }
  });

  socket.on("disconnect", (reason) => {
    for (let [id, s] of devices) {
      if (s === socket) devices.delete(id);
    }
    console.log("WS disconnected", socket.id, "— reason:", reason);
  });

  socket.on("error", (err) => {
    console.error("Client socket error:", err);
  });
});

cron.schedule(
  "0 20 * * *",
  () => {
    console.log("Pausing Atlas cluster at 20:00 IST");
    toggleCluster(true);
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);

cron.schedule(
  "50 7 * * *",
  () => {
    console.log("Resuming Atlas cluster at 08:00 IST");
    toggleCluster(false);
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);

server.listen(process.env.PORT, () => {
  console.log(`App is running on the port:${process.env.PORT}`);
});
