import expressAsyncHandler from "express-async-handler";
import {
  WorkOrder,
  Operation,
  Tray,
  Operator,
  ScanEvent,
  Machine,
  CutSheet,
} from "../Model/RfidModels.js";
import mongoose from "mongoose";
import qrcode from "qrcode";

export const addWorkOrder = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const {
      workOrderNo,
      quantity,
      colors,
      sizes,
      dueDate,
      combinedQuantities,
    } = req.body;
    const wo = await WorkOrder.create({
      workOrderNo,
      quantity,
      colors,
      sizes,
      dueDate,
      combinedQuantities,
      companyId,
    });
    return res.status(201).json(wo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create work order" });
  }
};

export const addOperation = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const { name, code, description = "", sequence, workOrder } = req.body;
    const op = await Operation.create({
      name,
      code,
      description,
      sequence,
      companyId,
      workOrder,
    });
    return res.status(201).json(op);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create operation" });
  }
};

export const addMachine = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const { machineId, operation, lineNumber } = req.body;
    const m = await Machine.create({
      machineId,
      operation,
      lineNumber,
      companyId,
    });
    return res.status(201).json(m);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create machine" });
  }
};

export const addNewTray = async (req, res) => {
  try {
    const { rfidTag, workOrder, color, size, companyId, lineNumber } = req.body;
    const tray = await Tray.create({
      rfidTag,
      workOrder,
      color,
      size,
      companyId,
      lineNumber,
    });
    return res.status(201).json(tray);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        error: "Tray with this RFID already exists for the given company.",
      });
    }
    return res.status(500).json({ error: "Failed to create new tray" });
  }
};

export const addOperator = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const { operatorId, name, loginAt } = req.body;
    const op = await Operator.create({
      operatorId,
      name,
      loginAt,
      companyId,
    });
    return res.status(201).json(op);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create operator" });
  }
};

export const addScanEvent = async (req, res) => {
  try {
    const { rfidTag, machineId, operatorId, operationId, companyId } = req.body;

    const trayDoc = await Tray.findOne(
      { rfidTag, companyId },
      { _id: 1, workOrder: 1 }
    ).lean();
    if (!trayDoc) {
      return res
        .status(404)
        .json({ error: `Tray not found for RFID ${rfidTag}` });
    }
    const trayId = trayDoc._id;
    const workOrderId = trayDoc.workOrder;

    const opDoc = await Operation.findOne(
      { _id: operationId, companyId, workOrder: workOrderId },
      { sequence: 1 }
    ).lean();
    if (!opDoc) {
      return res.status(400).json({
        error: `Operation ${operationId} not defined for this work order`,
      });
    }
    const seq = opDoc.sequence;

    const existing = await ScanEvent.findOne({
      tray: trayId,
      operation: operationId,
      operator: operatorId,
      companyId,
    }).lean();
    if (existing) {
      return res.status(409).json({
        error: `Operation (${operationId}) already scanned by operator (${operatorId}) on this tray.`,
      });
    }

    if (seq > 1) {
      const prevOp = await Operation.findOne(
        { sequence: seq - 1, companyId, workOrder: workOrderId },
        { _id: 1 }
      ).lean();
      if (!prevOp) {
        return res.status(400).json({
          error: `No operation defined at sequence ${
            seq - 1
          } for this work order.`,
        });
      }

      const prevScan = await ScanEvent.findOne({
        tray: trayId,
        operation: prevOp._id,
        companyId,
      }).lean();
      if (!prevScan) {
        return res.status(412).json({
          error: `Previous operation (sequence ${seq - 1}) not yet scanned.`,
        });
      }
    }

    const evt = await ScanEvent.create({
      tray: trayId,
      workOrder: workOrderId,
      machine: machineId,
      operator: operatorId,
      operation: operationId,
      companyId,
    });

    return res.status(201).json(evt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record scan event" });
  }
};

export const outputScan = expressAsyncHandler(async (req, res) => {
  try {
    const { rfidTag, scannedAt = Date.now(), lineNumber, companyId } = req.body;

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const scannedDate = new Date(new Date(scannedAt).getTime() + IST_OFFSET);

    const existingTray = await Tray.findOne(
      { rfidTag, companyId },
      { _id: 1, completedAt: 1, lineNumber: 1 }
    ).lean();

    if (existingTray) {
      if (existingTray.completedAt) {
        return res.status(409).json({
          error: "Tray already completed",
          code: "ALREADY_COMPLETED",
          completedAt: existingTray.completedAt,
        });
      }

      const updateFields = { completedAt: scannedAt };
      if (existingTray.lineNumber !== lineNumber) {
        updateFields.lineNumber = lineNumber;
      }

      const updatedTray = await Tray.findOneAndUpdate(
        { _id: existingTray._id },
        { $set: updateFields },
        {
          new: true,
          projection: {
            _id: 1,
            rfidTag: 1,
            companyId: 1,
            lineNumber: 1,
            workOrder: 1,
            color: 1,
            size: 1,
            completedAt: 1,
          },
        }
      ).lean();

      return res.status(200).json(updatedTray);
    }

    const recentTray = await Tray.findOne(
      {
        companyId,
        lineNumber,
        completedAt: { $exists: true },
      },
      { workOrder: 1, color: 1, size: 1 }
    )
      .sort({ completedAt: -1 })
      .lean();

    if (!recentTray) {
      return res.status(400).json({
        error:
          "No existing tray with same lineNumber & completedAt found; cannot infer workOrder/color/size.",
      });
    }

    const newTray = new Tray({
      rfidTag,
      companyId,
      lineNumber,
      workOrder: recentTray.workOrder,
      color: recentTray.color,
      size: recentTray.size,
      completedAt: new Date(scannedAt),
    });

    await newTray.save();
    return res.status(201);
  } catch (err) {
    console.error("outputScan error:", err);
    return res.status(500).json({ error: "Failed to process output scan" });
  }
});

export const getAllOperations = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const ops = await Operation.find({ companyId });
    return res.status(200).json(ops);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch operations" });
  }
};

export const getAllWorkOrder = async (req, res) => {
  try {
    const companyId = req.user?.companyId || req.user?.companyID;

    if (!companyId) {
      console.error("Company ID not found in user object:", req.user);
      return res
        .status(400)
        .json({ error: "Company ID is missing. Unable to fetch work orders." });
    }

    const ops = await WorkOrder.find({ companyId })
      .select("_id workOrderNo quantity dueDate")
      .lean();

    if (!ops || ops.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(ops);
  } catch (err) {
    console.error(
      `Error fetching WorkOrder for companyId '${companyId}':`,
      err
    );
    return res.status(500).json({
      error: "Failed to fetch WorkOrders. An internal server error occurred.",
    });
  }
};

export const needleRoomIn = async (req, res) => {
  try {
    const { rfidTag, scannedAt = Date.now(), companyId } = req.body;

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const scannedDate = new Date(new Date(scannedAt).getTime() + IST_OFFSET);

    const updatedTray = await Tray.findOneAndUpdate(
      {
        rfidTag,
        companyId,
        $or: [
          { completedAt: { $exists: false } },
          { needleRoomInTime: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            completedAt: { $ifNull: ["$completedAt", scannedDate] },
            needleRoomInTime: { $ifNull: ["$needleRoomInTime", scannedDate] },
          },
        },
        { $unset: "rfidTag" },
      ],
      {
        new: true,
        projection: { _id: 1, needleRoomInTime: 1, completedAt: 1 },
      }
    );

    if (updatedTray) {
      return res.status(200).json({
        _id: updatedTray._id,
        needleRoomInTime: updatedTray.needleRoomInTime,
        completedAt: updatedTray.completedAt,
      });
    }

    const existingTray = await Tray.findOne(
      { rfidTag, companyId },
      { needleRoomInTime: 1, completedAt: 1 }
    );

    if (!existingTray) {
      return res
        .status(404)
        .json({ error: `Tray not found for RFID ${rfidTag}` });
    }

    return res.status(409).json({
      error: "Needle room entry already recorded",
      code: "ALREADY_RECORDED",
      needleRoomInTime: existingTray.needleRoomInTime,
      completedAt: existingTray.completedAt,
    });
  } catch (err) {
    console.error("needleRoomIn error:", err);
    return res.status(500).json({ error: "Failed to process needle room in" });
  }
};

export const addCheckInfo = async (req, res) => {
  try {
    const { rfidTag, results } = req.body;
    if (!rfidTag || !Array.isArray(results)) {
      return res
        .status(400)
        .json({ error: "rfidTag and results[] are required" });
    }
    const normalizedTag = rfidTag.toUpperCase();

    const checkingArray = results.map((r) => ({
      step: r.step,
      passed: r.pass,
    }));

    const updated = await Tray.findOneAndUpdate(
      { rfidTag: normalizedTag },
      { $set: { checking: checkingArray } },
      {
        new: false,
        fields: { _id: 1 },
      }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ error: `Tray not found for RFID ${rfidTag}` });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("submit-checks error:", err);
    return res.status(500).json({ error: "Failed to save checking results" });
  }
};

export const getAllRfidCutSheets = async (req, res) => {
  const { orderIdNew } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderIdNew)) {
    return res.status(400).json({ error: "Invalid orderIdNew." });
  }

  try {
    const cuts = await CutSheet.find(
      { workOrderID: orderIdNew },
      { __v: 0 } // exclude __v to reduce payload
    )
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.status(200).json({ orderCutSheet: cuts });
  } catch (err) {
    console.error("Error in getAllCutSheets:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

export const createRfidCutSheet = async (req, res) => {
  const { orderIdNew, sizes, color, quantity, lot, shade } = req.body;

  if (!orderIdNew || !sizes || !color || !quantity) {
    return res
      .status(400)
      .json({ error: "orderIdNew, sizes, color, and quantity are required." });
  }

  if (!mongoose.Types.ObjectId.isValid(orderIdNew)) {
    return res.status(400).json({ error: "Invalid orderIdNew format." });
  }

  try {
    const qrPayload = `${orderIdNew}_${color}_${sizes}_${quantity}`;
    const qrCodeDataURL = await qrcode.toDataURL(qrPayload);

    const doc = await WorkOrder.findById(orderIdNew)
      .select("workOrderNo")
      .lean();

    const workOrderNo = doc.workOrderNo;

    const lastCut = await CutSheet.find({ workOrderID: orderIdNew })
      .sort({ bundelNo: -1 }) // highest first
      .limit(1)
      .lean();

    let lastBundel = 0;
    if (
      lastCut.length > 0 &&
      typeof lastCut[0].bundelNo === "number" &&
      !isNaN(lastCut[0].bundelNo)
    ) {
      lastBundel = lastCut[0].bundelNo;
    }
    const nextBundel = lastBundel + 1;

    const newCut = new CutSheet({
      workOrderID: orderIdNew,
      sizes,
      color,
      quantity,
      lot,
      shade,
      workOrderNo,
      qrCode: qrCodeDataURL,
      bundelNo: nextBundel,
      isPrinted: false,
    });
    const savedCut = await newCut.save();

    return res
      .status(201)
      .json({ message: "CutSheet created successfully.", data: savedCut });
  } catch (err) {
    console.error("Error in createCutSheet:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

export const getRfidWorkOrder = async (req, res) => {
  try {
    const { orderIdNew } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderIdNew)) {
      return res.status(400).json({ error: "Invalid orderIdNew." });
    }
    const ops = await WorkOrder.findById(orderIdNew);
    return res.status(200).json(ops);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch operations" });
  }
};

export const packingTime = async (req, res) => {
  try {
    const { rfidID, scannedAt = Date.now(), companyId } = req.body;

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const scannedDate = new Date(new Date(scannedAt).getTime() + IST_OFFSET);

    const updatedTray = await Tray.findOneAndUpdate(
      {
        rfidTag: rfidID,
        companyId,
        $or: [
          { completedAt: { $exists: false } },
          { packingAtTime: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            completedAt: {
              $ifNull: ["$completedAt", scannedDate],
            },
            packingAtTime: {
              $cond: [
                { $eq: ["$completedAt", null] },
                scannedDate,
                { $ifNull: ["$packingAtTime", scannedDate] },
              ],
            },
          },
        },
      ],
      {
        new: true,
        projection: { _id: 1, packingAtTime: 1, completedAt: 1 },
      }
    );

    if (updatedTray) {
      return res.status(200).json({
        _id: updatedTray._id,
        packingAtTime: updatedTray.packingAtTime,
        completedAt: updatedTray.completedAt,
      });
    }

    const existingTray = await Tray.findOne(
      { rfidTag: rfidID, companyId },
      { packingAtTime: 1, completedAt: 1 }
    );

    if (!existingTray) {
      return res
        .status(404)
        .json({ error: `Tray not found for RFID ${rfidID}` });
    }

    // Both timestamps already recorded → conflict
    return res.status(409).json({
      error: "Packing time already recorded",
      code: "ALREADY_RECORDED",
      packingAtTime: existingTray.packingAtTime,
      completedAt: existingTray.completedAt,
    });
  } catch (err) {
    console.error("packingTime error:", err);
    return res
      .status(500)
      .json({ error: "Failed to process packing time update" });
  }
};
