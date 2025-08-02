import express from "express";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { addCheckInfo, addMachine, addNewTray, addOperation, addOperator, addScanEvent, addWorkOrder, createRfidCutSheet, getAllOperations, getAllRfidCutSheets, getAllWorkOrder, getRfidWorkOrder, needleRoomIn, outputScan, packingTime } from "../Controllers/rfidAddControllers.js";
import { cutQty, getColorSizeTrayCountsByWorkOrder, getColorSizeTrayFeedingCount, getDailyHourlyTrayCountsByWorkOrder, getTodayHourlyTrayCounts, trayStatus } from "../Controllers/rfidDataControllers.js";
import { packingInfo } from "../Controllers/packingConrtoller.js";

const rfidRouter = express.Router();

rfidRouter.post("/add/operations",verifyToken, addOperation);
rfidRouter.get("/get/all/operations",verifyToken, getAllOperations);
rfidRouter.get("/get/all/workorder",verifyToken, getAllWorkOrder);
rfidRouter.post("/add/WO",verifyToken, addWorkOrder);
rfidRouter.post("/add/machine",verifyToken, addMachine);
rfidRouter.post("/add/scan/event", addScanEvent);
rfidRouter.post("/add/operator",verifyToken, addOperator);
rfidRouter.post("/add/tray",verifyToken, addNewTray);
rfidRouter.post("/output/scan", outputScan);
rfidRouter.post("/needel/scan", needleRoomIn);
rfidRouter.post("/check/info",verifyToken, addCheckInfo);
rfidRouter.get("/cutsheet/all/:orderIdNew",verifyToken, getAllRfidCutSheets);
rfidRouter.post("/cutsheet/new",verifyToken, createRfidCutSheet);
rfidRouter.get("/workorder/:orderIdNew",verifyToken, getRfidWorkOrder);
rfidRouter.post("/update/packing", packingTime);

rfidRouter.post("/packing",verifyToken, packingInfo);

rfidRouter.post("/get/hourly/output",verifyToken, getTodayHourlyTrayCounts);
rfidRouter.post("/get/daily/wo/output",verifyToken, getDailyHourlyTrayCountsByWorkOrder);
rfidRouter.post("/get/total/wo/output",verifyToken, getColorSizeTrayCountsByWorkOrder);
rfidRouter.post("/get/new/cut/qty",verifyToken, cutQty); 
rfidRouter.post("/get/all/feeding/qty",verifyToken, getColorSizeTrayFeedingCount);trayStatus
rfidRouter.get("/led/temp",verifyToken, trayStatus);

export default rfidRouter;