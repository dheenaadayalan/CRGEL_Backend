import express from "express";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { getDailyOperationCounts } from "../Controllers/swDataControllers.js";

const swRouter = express.Router();

swRouter.get("/hourly/output", verifyToken, getDailyOperationCounts);

export default swRouter;