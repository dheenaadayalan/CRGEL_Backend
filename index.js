import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Database/config.js";
import orderRouter from "./Routes/orderRoutes.js";
import authRouter from "./Routes/authRoutes.js";
import qrCodeRouter from "./Routes/qrCodeRoutes.js";
import hrRouter from "./Routes/hrRoutes.js";
import cron from "node-cron";
import { sendProductionReportEmail } from "./Controllers/mailControllers.js";

dotenv.config();

const app = express();
app.use(express.json());

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

app.use('/api', orderRouter)
app.use('/api', authRouter)
app.use('/api',qrCodeRouter)
app.use('/api',hrRouter)
connectDB();

cron.schedule("0 12 * * *", () => {
  console.log("Sending production report email at 12:00 PM IST...");
  sendProductionReportEmail();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

cron.schedule("30 20 * * *", () => {
  console.log("Sending production report email at 8:30 PM IST...");
  sendProductionReportEmail();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});



app.listen(process.env.PORT, () => {
    console.log(`App is running on the port:${process.env.PORT}`);
  });
