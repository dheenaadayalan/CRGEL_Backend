import express from "express";
import { addCosting, getAllCosting, getAllEmp, orderByID, outputProductionReportMonth } from "../Controllers/hrControllers.js";
import { verifyToken } from "../Middleware/verfiyToken.js";

const hrRouter = express.Router();

hrRouter.get("/get/all/emp",verifyToken, getAllEmp);
hrRouter.get("/get/all/order/cpmpanyId",verifyToken,orderByID)
hrRouter.post("/add/costing/report",verifyToken, addCosting);
hrRouter.post("/month/output/report",verifyToken, outputProductionReportMonth);
hrRouter.get("/get/all/costing/cpmpanyId",verifyToken,getAllCosting)

export default hrRouter;
