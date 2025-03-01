import express from "express";
import { addCutSheet, addNewOrder, generateOutputProductionReport, getAllOrders, getOrder, getOrderStatusCountByDate } from "../Controllers/oderControllers.js";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { isCompanyOwner } from "../Middleware/isCompanyOwner.js";


const orderRouter = express.Router();

orderRouter.post("/add/new/order",verifyToken,isCompanyOwner, addNewOrder);
orderRouter.get("/allOrders",verifyToken, getAllOrders);
orderRouter.get("/order/:id", getOrder);
orderRouter.post("/add/new/cutsheet", addCutSheet);
orderRouter.post("/producation/report", verifyToken,generateOutputProductionReport);
orderRouter.get("/order/stauts/:id", getOrderStatusCountByDate);

export default orderRouter;