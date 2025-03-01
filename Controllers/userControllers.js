import User from "../Model/userModel.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import Company from "../Model/companyModel.js";
import Packing from "../Model/packingModel.js";

export const signUp = async (req, res) => {
  const { username, email, password, role, phoneNumber, companyId } = req.body;
  const hashedPassword = bcryptjs.hashSync(password, 10);
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
        success: false,
      });
    }
    const user = new User({
      username,
      email,
      password: hashedPassword,
      phoneNumber,
      role,
      companyId,
    });
    await user.save();
    res.json({
      message: "You have Successfully Registered",
      result: user,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server error in saving user.",
      error: error.message,
      success: false,
    });
  }
};

export const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userDetail = await User.findOne({ email });

    if (userDetail == null) {
      return res.json({
        message: "User not found! Invalid Credentials",
        success: false,
      });
    }
    const userPassword = bcryptjs.compareSync(password, userDetail.password);
    if (!userPassword) {
      return res.json({
        message: "User not found! Invalid Credentials",
        success: false,
      });
    }
    const token = jwt.sign(
      {
        id: userDetail._id,
        companyID: userDetail.companyId,
        role: userDetail.role,
      },
      process.env.JWT_SECRET_KEY
    );

    res.json({
      message: "You have Successfully Logged In",
      result: userDetail,
      success: true,
      token,
    });
  } catch (error) {
    res.json({
      message: "Internal Server error in Sign-in user",
      error: error.message,
      success: false,
    });
  }
};

export const newCompany = async (req, res) => {
  const {
    username,
    email,
    password,
    role,
    phoneNumber,
    companyName,
    companyAddress,
  } = req.body;
  const hashedPassword = bcryptjs.hashSync(password, 10);
  try {
    const newComapny = new Company({
      companyName,
      companyAddress,
    });
    await newComapny.save();

    const userCompanyDetail = await Company.findOne({ companyName });
    const ownerCompanyId = userCompanyDetail._id;

    const user = new User({
      username,
      email,
      password: hashedPassword,
      phoneNumber,
      role,
      companyId: ownerCompanyId,
    });
    await user.save();

    const userDetail = await User.findOne({ email });
    const ownerId = userDetail._id;
    await Company.findByIdAndUpdate(ownerCompanyId, { ownerId: ownerId });
    res.json({
      message: "You have Successfully Registered",
      result: user,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server error in saving user.",
      error: error.message,
      success: false,
    });
  }
};

export const users = async (req, res) => {
  const companyId = req.user.companyID;

  try {
    const users = await User.find(
      { companyId },
      { username: 1, role: 1, _id: 0 }
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        message: "No users found for the given companyId",
        success: false,
      });
    }

    res.status(200).json({
      message: "Users fetched successfully",
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
};

export const addBarcode = async (req, res) => {
  try {
    
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ error: "Barcode is required" });

    let packingEntry = await Packing.findOne();
    if (!packingEntry) {
      return res.status(400).json({ error: "No order found" });
    }
   
    let barcodeEntry = packingEntry.orderPackingInfo.find(
      (item) => item.barcode === barcode
    );
    if (barcodeEntry) {
      barcodeEntry.count += 1;
    } else {
      return res.status(400).json({ error: "Barcode not found in order" });
    }

    await packingEntry.save();
    res.json({ success: true, packingEntry });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
};

export const getPackingInfo = async (req, res) => {
  try {
    const id = "67c2c3914a288bb0dab23812"
    const packingEntry = await Packing.findById(id);
    res.json({ success: true, packingInfo:packingEntry });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
};
