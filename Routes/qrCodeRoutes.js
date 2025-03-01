import express from "express";
import { addQrCodeDevice, getQrCodeDevicesByCompany, qrCodeID, signInQrCodeDevice, trayQrCode, updateTrayOutput } from "../Controllers/qrCodeControllers.js";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { isCompanyOwner } from "../Middleware/isCompanyOwner.js";

const qrCodeRouter = express.Router();

qrCodeRouter.get("/order/cutsheet/:qrCode",qrCodeID)
qrCodeRouter.post("/assign/tray",trayQrCode)
qrCodeRouter.post("/add/qrcode/device",verifyToken,isCompanyOwner,addQrCodeDevice)
qrCodeRouter.get("/get/qrcode/device",verifyToken,getQrCodeDevicesByCompany)
qrCodeRouter.post("/signin/qrcode/device",signInQrCodeDevice)
qrCodeRouter.post("/update/tray/output",updateTrayOutput)

export default qrCodeRouter;