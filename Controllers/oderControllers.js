import Order from "../Model/orderModel.js";
import qrcode from "qrcode";
import mongoose from "mongoose";

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const addNewOrder = async (req, res) => {
  const companyId = req.user.companyID;

  const {
    orderName,
    orderNumber,
    styleNumber,
    sizes,
    colous,
    orderQuantity,
    excessPercentage,
    excessQuantity,
    totalQuantity,
    orderDiscription,
    combinedQuantities,
    cutcombinedQuantities,
  } = req.body;

  const newOrder = new Order({
    orderName,
    orderNumber,
    sizes,
    colous,
    styleNumber,
    combinedQuantities,
    excessQuantity,
    orderQuantity,
    excessPercentage,
    totalQuantity,
    orderDiscription,
    cutcombinedQuantities,
    companyId,
    orderCutSheet: [],
  });

  try {
    const savedOrder = await newOrder.save();
    res.status(200).json({
      message: "Added new order.",
      success: true,
      order: savedOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server error in saving order.",
      error: error.message,
      success: false,
    });
  }
};

export const getAllOrders = async (req, res) => {
  const companyId = req.user.companyID;
  try {
    const allOrders = await Order.find({ companyId: companyId })
      .select('_id orderNumber orderDiscription styleNumber orderQuantity totalQuantity')
      .lean();
    res.json({
      allOrder: allOrders,
      message: "All orders fetched",
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server error getting all the orders",
      error: error,
      success: false,
    });
  }
};

export const getOrder = async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await Order.findById(orderId);
    res.json({
      order: order,
      message: "Orders by ID feched",
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server error in Getting the order",
      error: error,
      success: false,
    });
  }
};

export const addCutSheet = async (req, res) => {
  const {
    color,
    sizes,
    quantity,
    orderId,
    orderName,
    orderNumber,
    shade,
    lot,
  } = req.body;
  if (!color || !sizes || !quantity) {
    return res
      .status(400)
      .json({ error: "Color, size, and quantity are required." });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const key = `${sizes}-${color}`;

    // Check if the cut sheet exceeds the allowed quantities
    const currentAllowedQuantity = order.combinedQuantities.get(key) || 0;
    const currentCutQuantity = order.cutcombinedQuantities.get(key) || 0;

    if (currentCutQuantity + quantity > currentAllowedQuantity) {
      return res.status(400).json({ error: "Exceeds allowed quantity limit." });
    }

    // Generate unique piece IDs
    let lastPieceId = 0;
    if (order.orderCutSheet.length > 0) {
      const lastCutSheet = order.orderCutSheet[order.orderCutSheet.length - 1];
      lastPieceId =
        lastCutSheet.pieces[lastCutSheet.pieces.length - 1]?.pieceId || 0;
    }

    const newPieces = [];
    for (let i = 1; i <= quantity; i++) {
      newPieces.push({
        pieceId: lastPieceId + i,
        sizes,
        color,
        status: "Store",
        trayQrCode: null,
      });
    }

    // Add the new cut sheet
    const newCutSheet = {
      color,
      sizes,
      quantity,
      orderName,
      orderNumber,
      shade,
      lot,
      pieces: newPieces,
    };

    // Push the cut sheet to generate an _id
    order.orderCutSheet.push(newCutSheet);

    // Update combined cut quantities
    order.cutcombinedQuantities.set(
      key,
      (order.cutcombinedQuantities.get(key) || 0) + quantity
    );

    // Save to generate the _id for the new cut sheet
    await order.save();

    // Retrieve the newly added cut sheet with its _id
    const savedCutSheet = order.orderCutSheet[order.orderCutSheet.length - 1];
    const qrCodeData = `${savedCutSheet._id}`;
    const qrCodeUrl = await qrcode.toDataURL(qrCodeData);

    savedCutSheet.qrCode = qrCodeUrl;

    // Save the updated order with the QR code URL
    await order.save();

    res.status(201).json({ message: "Cut sheet created successfully.", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const generateOutputProductionReport = async (req, res) => {
  const companyId = req.user.companyID;
  const { date, status } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error("Invalid companyId format");
    }
    if (!status) {
      throw new Error("Status is required.");
    }

    // Convert input date to start of the selected day
    const selectedDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(
      Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        selectedDate.getUTCDate(),
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        selectedDate.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const orders = await Order.find({ companyId }).lean(); 

    let hourlyCount = {}; 
    let dailyCount = 0;

    orders.forEach((order) => {
      order.orderCutSheet.forEach((cutSheet) => {
        cutSheet.pieces.forEach((piece) => {
          if (piece.status === status && piece.lineNumber) {
            const updatedAt = new Date(piece.updatedAt);
            if (updatedAt >= startOfDay && updatedAt <= endOfDay) {
              const hour = updatedAt.getUTCHours();
              const hourRange = `${hour}:00-${hour}:59`;
              const line = piece.lineNumber;
              if (!hourlyCount[line]) {
                hourlyCount[line] = {};
              }
              if (!hourlyCount[line][hourRange]) {
                hourlyCount[line][hourRange] = 0;
              }
              hourlyCount[line][hourRange]++;
              dailyCount++;
            }
          }
        });
      });
    });

    Object.keys(hourlyCount).forEach((line) => {
      const total = Object.values(hourlyCount[line]).reduce(
        (sum, count) => sum + count,
        0
      );
      hourlyCount[line]["Total"] = total;
    });
    res
      .status(201)
      .json({ message: "Production Report", hourlyCount, dailyCount });
  } catch (error) {
    console.error("Error fetching output count:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getOrderStatusCountByDate = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const statusData = {};
    order.orderCutSheet.forEach((cutSheet) => {
      cutSheet.pieces.forEach((piece) => {
        const { status, color, sizes } = piece;
        if (!statusData[status]) {
          statusData[status] = { Total: 0 };
        }

        // Ensure color exists under this status
        if (!statusData[status][color]) {
          statusData[status][color] = { Total: 0 };
        }

        // Ensure size exists under this color
        if (!statusData[status][color][sizes]) {
          statusData[status][color][sizes] = 0;
        }

        // Increment counts
        statusData[status][color][sizes] += 1;
        statusData[status][color]["Total"] += 1; // Update total for the color
        statusData[status]["Total"] += 1; // Update total for the status
      });
    });

    res.json({ message: "Order Report", statusData });
  } catch (error) {
    console.error("Error in getOrderStatusCountByDate:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const isTurePrint = async (req, res) => {
  try {
    const { id } = req.body; // Extract id from request body

    const result = await Order.updateOne(
      { "orderCutSheet._id": id },
      { $set: { "orderCutSheet.$.isPrinted": true } }
    );

    if (result.modifiedCount > 0) {
      return res
        .status(200)
        .json({ success: true, message: "Cut-Sheet marked as printed." });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Cut-Sheet not found." });
    }
  } catch (error) {
    console.error("Error in getOrderStatusCountByDate:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const deleteOrderCutSheet = async (req, res) => {
  console.log("its in back");

  try {
    const { orderId, cutSheetId } = req.params;

    // Find the order and update by pulling the specific cut sheet
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $pull: { orderCutSheet: { _id: cutSheetId } } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Cut sheet deleted successfully", updatedOrder });
  } catch (error) {
    res.status(500).json({ message: "Error deleting cut sheet", error: error.message });
  }
};


// simple in‐memory cache
let _cachedJson = null;
let _cacheTs = 0; // timestamp in ms

export const ledStatus = asyncHandler(async (req, res) => {
  try {
    const now = Date.now();

    // if we have cached data that's younger than 5 minutes, return it
    if (_cachedJson && now - _cacheTs < 5 * 60 * 1000) {
      return res.status(200).send(_cachedJson);
    }

    // otherwise recompute and update cache
    const jsNow = new Date(now);
    const istDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(jsNow);
    const startIST = new Date(`${istDateStr}T00:00:00+05:30`);
    const endIST = new Date(`${istDateStr}T23:59:59.999+05:30`);

    const ledStatusData = await Order.aggregate([
      { $unwind: "$orderCutSheet" },
      { $unwind: "$orderCutSheet.pieces" },
      {
        $group: {
          _id: "$orderCutSheet.pieces.lineNumber",
          input: {
            $sum: {
              $cond: [{ $eq: ["$orderCutSheet.pieces.status", "In-Line"] }, 1, 0],
            },
          },
          output: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$orderCutSheet.pieces.status", "Output"] },
                    { $gte: ["$orderCutSheet.pieces.updatedAt", startIST] },
                    { $lte: ["$orderCutSheet.pieces.updatedAt", endIST] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          lineNumber: {
            $toUpper: {
              $replaceAll: {
                input: { $ifNull: ["$_id", ""] },
                find: "-",
                replacement: "",
              },
            },
          },
          input: 1,
          output: 1,
          _id: 0,
        },
      },
      { $match: { lineNumber: { $ne: "" } } },
    ]);

    const jsonResponse = JSON.stringify({ data: ledStatusData });

    // update cache
    _cachedJson = jsonResponse;
    _cacheTs = now;

    return res.status(200).send(jsonResponse);
  } catch (error) {
    return res
      .status(500)
      .send(
        JSON.stringify({
          message: "Error Getting status",
          error: error.message,
        })
      );
  }
});

