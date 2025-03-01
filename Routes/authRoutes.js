import express from "express";
import {
  addBarcode,
  getPackingInfo,
  newCompany,
  signIn,
  signUp,
  users,
} from "../Controllers/userControllers.js";
import { verifyToken } from "../Middleware/verfiyToken.js";
import { isCompanyOwner } from "../Middleware/isCompanyOwner.js";

const authRouter = express.Router();

authRouter.post("/add/new/user", verifyToken, isCompanyOwner, signUp);
authRouter.post("/signin/user", signIn);
authRouter.post("/add/new/company", newCompany);
authRouter.get("/users/by/companyId", verifyToken, isCompanyOwner, users);
authRouter.post("/add/new/barcode", addBarcode);
authRouter.get("/packing", getPackingInfo);

export default authRouter;
