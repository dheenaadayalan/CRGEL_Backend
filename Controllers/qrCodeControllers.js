import Order from "../Model/orderModel.js";
import QrCodeDevice from "../Model/qrCodeDeviceModel.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

export const qrCodeID = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const order = await Order.findOne({ "orderCutSheet._id": qrCode });
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found", success: false, color: "red" });
    }
    const orderCutSheet = order.orderCutSheet.find(
      (sheet) => sheet._id.toString() === qrCode
    );

    if (!orderCutSheet) {
      return res.status(404).json({
        message: "Cut sheet not found",
        success: false,
        color: "red",
        h: "कट-शीट नहीं मिली",
      });
    }
    res.json({
      message: "Cut sheet scanned successfully now scan tray QR Code",
      success: true,
      orderCutSheet,
      color: "green",
      h: "कट शीट को सफलतापूर्वक स्कैन किया गया अब ट्रे क्यूआर कोड को स्कैन करें",
    });
  } catch (error) {
    console.error("Error fetching orderCutSheet:", error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const trayQrCode = async (req, res) => {
  try {
    const { orderId, cutSheetQrCode, trayQrCode, status, lineNumber } =
      req.body;
    const existingOrder = await Order.findOne({
      "orderCutSheet.pieces.trayQrCode": trayQrCode,
    });
    if (existingOrder) {
      return res.status(400).json({
        message:
          "This Tray is already assigned to another Piece. Scan a different tray.",
        success: false,
        color: "yellow",
        h: "यह ट्रे पहले से ही दूसरे टुकड़े को सौंपी गई है। एक अलग ट्रे स्कैन करें",
      });
    }
    const order = await Order.findOne({ "orderCutSheet._id": orderId });
    if (!order) {
      return res.status(404).json({
        message: "Please Scan Cut-Sheet QR Code",
        success: false,
        color: "yellow",
        h: "कृपया कट-शीट क्यूआर कोड स्कैन करें",
      });
    }
    const orderCutSheet = order.orderCutSheet.find(
      (sheet) => sheet.qrCode === cutSheetQrCode
    );
    if (!orderCutSheet) {
      return res.status(404).json({
        message: "Order cut sheet not found",
        success: false,
        color: "red",
        h: "ऑर्डर कट शीट नहीं मिली",
      });
    }
    const unassignedPiece = orderCutSheet.pieces.find(
      (piece) => !piece.trayQrCode && piece.status !== "Output"
    );

    if (!unassignedPiece) {
      return res.status(400).json({
        message:
          "All pieces are already assigned with Tray. Scan new Cut Sheet",
        success: false,
        color: "yellow",
        h: "सभी टुकड़े पहले से ही ट्रे के साथ निर्दिष्ट हैं। नई कट शीट स्कैन करें",
      });
    }

    const date = new Date().toLocaleDateString("en-GB");
    const pieceColor = unassignedPiece.color;
    let pieceSize = unassignedPiece.sizes;

    if (!pieceColor || !pieceSize) {
      console.error("Error: pieceColor or pieceSize is undefined!");
      return res.status(500).json({ message: "Invalid pieceColor or pieceSize", success: false });
    }

    if (pieceSize === "2XL") {
      pieceSize = "XXL";
    } else if (pieceSize === "3XL") {
      pieceSize = "XXXL";
    }

    if (!(order.inputData instanceof Map)) {
      order.inputData = new Map();
    }

    let dateData = order.inputData.get(date);
    if (!dateData) {
      dateData = { lineNumbers: new Map() };
    } else if (!(dateData.lineNumbers instanceof Map)) {
      dateData.lineNumbers = new Map(Object.entries(dateData.lineNumbers || {}));
    }

    let lineData = dateData.lineNumbers.get(lineNumber);
    if (!lineData) {
      lineData = { M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0 };
    }

    lineData[pieceSize] = (lineData[pieceSize] || 0) + 1;

    dateData.lineNumbers.set(lineNumber, lineData);
    order.inputData.set(date, dateData);
    order.markModified("inputData");

    unassignedPiece.trayQrCode = trayQrCode;
    unassignedPiece.status = status;
    unassignedPiece.lineNumber = lineNumber;
    await order.save();
    res.json({
      message: "Tray QR code scanned successfully",
      success: true,
      unassignedPiece,
      color: "green",
      h: "ट्रे क्यूआर कोड सफलतापूर्वक स्कैन किया गया",
    });
  } catch (error) {
    console.error("Error assigning trayQrCode:", error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const addQrCodeDevice = async (req, res) => {
  const companyId = req.user.companyID;
  try {
    const { deviceName, password, roles, lineNumber } = req.body;

    if (!deviceName || !password || !roles || !lineNumber) {
      return res.status(400).json({
        success: false,
        message: "Device name, password, and at least one role are required.",
      });
    }
    const hashedPassword = bcryptjs.hashSync(password, 10);
    const newDevice = new QrCodeDevice({
      deviceName,
      password: hashedPassword,
      roles,
      lineNumber,
      companyId,
    });
    await newDevice.save();

    res.status(201).json({
      success: true,
      message: "QR code device added successfully.",
      device: {
        id: newDevice._id,
        deviceName: newDevice.deviceName,
        roles: newDevice.roles,
      },
    });
  } catch (error) {
    console.error("Error adding QR code device:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Device name already exists.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getQrCodeDevicesByCompany = async (req, res) => {
  try {
    const companyId = req.user.companyID;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required.",
      });
    }
    const devices = await QrCodeDevice.find({ companyId });

    res.status(200).json({
      success: true,
      message: "QR Code Devices retrieved successfully.",
      devices,
    });
  } catch (error) {
    console.error("Error fetching QR Code Devices:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};

export const signInQrCodeDevice = async (req, res) => {
  try {
    const { deviceName, password } = req.body;

    // Validate input
    if (!deviceName || !password) {
      return res.status(400).json({
        success: false,
        message: "Device name and password are required.",
      });
    }
    const device = await QrCodeDevice.findOne({ deviceName });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found.",
      });
    }
    const isPasswordValid = await bcryptjs.compare(password, device.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }
    const token = jwt.sign(
      { deviceId: device._id, companyId: device.companyId, role: device.roles },
      process.env.JWT_SECRET_KEY
    );

    res.status(200).json({
      success: true,
      message: "Sign-in successful.",
      token,
      device: {
        id: device._id,
        deviceName: device.deviceName,
        role: device.roles,
        lineNumber: device.lineNumber,
        type: "qrdevice",
      },
    });
  } catch (error) {
    console.error("Error during QR Code Device sign-in:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};

export const updateTrayOutput = async (req, res) => {
  const { trayQrCode } = req.body;

  if (!trayQrCode) {
    return res.status(400).json({
      success: false,
      message: "Tray QR code is required.",
      color: "red",
      h: "ट्रे QR कोड आवश्यक है.",
    });
  }

  try {
    // Find the order containing the piece with the specified trayQrCode
    const order = await Order.findOne({
      "orderCutSheet.pieces.trayQrCode": trayQrCode,
    });

    if (!order) {
      return res.json({
        success: false,
        message: `No order or cut sheet found containing the specified tray QR code.${trayQrCode}`,
        color: "red",
        h: "निर्दिष्ट ट्रे क्यूआर कोड वाला कोई ऑर्डर या कट शीट नहीं मिली।",
      });
    }

    // Find the specific piece with the trayQrCode
    let foundPiece = null;

    for (const cutSheet of order.orderCutSheet) {
      foundPiece = cutSheet.pieces.find(
        (piece) => piece.trayQrCode === trayQrCode
      );
      if (foundPiece) break;
    }

    if (!foundPiece) {
      return res.status(404).json({
        success: false,
        message: "Tray not found.",
      });
    }
    if (foundPiece) {
      foundPiece.status = "Output";
      foundPiece.trayQrCode = null; // Clear the trayQrCode
    }

    // Save the updated order
    await order.save();

    res.status(200).json({
      success: true,
      message: "Tray scanned updated successfully.",
      color: "green",
      h: "ट्रे स्कैन सफलतापूर्वक अपडेट किया गया।",
    });
  } catch (err) {
    console.error("Error updating tray status:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the tray status.",
    });
  }
};
