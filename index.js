import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./Database/config.js";
import orderRouter from "./Routes/orderRoutes.js";
import authRouter from "./Routes/authRoutes.js";
import qrCodeRouter from "./Routes/qrCodeRoutes.js";

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
connectDB();

app.listen(process.env.PORT, () => {
    console.log(`App is running on the port:${process.env.PORT}`);
  });
