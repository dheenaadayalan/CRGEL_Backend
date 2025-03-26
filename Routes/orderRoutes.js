import express from "express";
import { addCutSheet, addNewOrder, deleteOrderCutSheet, generateOutputProductionReport, getAllOrders, getOrder, getOrderStatusCountByDate, isTurePrint, ledStatus } from "../Controllers/oderControllers.js";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { isCompanyOwner } from "../Middleware/isCompanyOwner.js";


const orderRouter = express.Router();

orderRouter.post("/add/new/order",verifyToken,isCompanyOwner, addNewOrder);
orderRouter.get("/allOrders",verifyToken, getAllOrders);
orderRouter.get("/order/:id", getOrder);
orderRouter.post("/add/new/cutsheet", addCutSheet);
orderRouter.post("/producation/report", verifyToken,generateOutputProductionReport);
orderRouter.get("/order/stauts/:id", getOrderStatusCountByDate);
orderRouter.post("/add/isPrint",isTurePrint );
orderRouter.post("/led/status",ledStatus );
//orderRouter.delete("/orders/:orderId/cutSheets/:cutSheetId", deleteOrderCutSheet);

export default orderRouter;