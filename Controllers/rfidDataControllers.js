import mongoose from "mongoose";
import { CutSheet, Tray } from "../Model/RfidModels.js";
import expressAsyncHandler from "express-async-handler";

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export const getTodayHourlyTrayCounts = async (req, res) => {
  try {
    // 1. Company ID from JWT middleware
    const companyId = req.user.companyID;
    if (!companyId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: missing companyID" });
    }

    const { date } = req.body;
    if (!date) {
      return res
        .status(400)
        .json({ message: "Missing required `date` query param (YYYY-MM-DD)" });
    }
    const parts = date.split("-").map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }
    const [year, month, day] = parts;

    // 3. Build IST window:   00:00 IST → 24:00 IST of that date
    //    We want the *moments* that correspond to IST‑midnight, expressed as UTC internally:
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    // Date.UTC(...) gives you a UTC‐midnight on that calendar date:
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const pipeline = [
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          completedAt: { $gte: start, $lt: end },
        },
      },
      {
        $project: {
          lineNumber: 1,
          hour: {
            $hour: {
              date: "$completedAt",
            },
          },
        },
      },
      {
        $group: {
          _id: { lineNumber: "$lineNumber", hour: "$hour" },
          count: { $sum: 1 },
        },
      },
    ];

    const aggResults = await Tray.aggregate(pipeline);

    // 4. Collect all distinct hours
    const hoursSet = new Set(aggResults.map((r) => r._id.hour));
    const hoursList = Array.from(hoursSet).sort((a, b) => a - b);

    // 5. Build a map: lineNumber -> { lineNumber, "HH:00": count, ... }
    const lineMap = {};
    aggResults.forEach(({ _id: { lineNumber, hour }, count }) => {
      if (!lineMap[lineNumber]) {
        lineMap[lineNumber] = { lineNumber };
      }
      const key = String(hour).padStart(2, "0") + ":00";
      lineMap[lineNumber][key] = count;
    });

    // 6. Fill missing hours with 0, compute Total
    const data = Object.values(lineMap).map((lineObj) => {
      let total = 0;
      hoursList.forEach((hour) => {
        const key = String(hour).padStart(2, "0") + ":00";
        const val = lineObj[key] || 0;
        lineObj[key] = val;
        total += val;
      });
      lineObj.Total = total;
      return lineObj;
    });

    // 7. Return in the shape your frontend needs
    return res.json({
      date,
      companyId,
      data,
    });
  } catch (err) {
    console.error("Error in getHourlyTrayCount:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getDailyHourlyTrayCountsByWorkOrder = async (req, res) => {
  const companyId = req.user.companyID;
  const { workOrderId } = req.body;

  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error("Invalid companyId format");
    }
    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
      throw new Error("Invalid workOrderId format");
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const workOrderObjectId = new mongoose.Types.ObjectId(workOrderId);

    const agg = await Tray.aggregate([
      {
        $match: {
          companyId: companyObjectId,
          workOrder: workOrderObjectId,
          // Only trays with a completedAt timestamp:
          completedAt: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt",
              timezone: "UTC",
            },
          },
          hour: { $hour: "$completedAt" }, // Raw UTC hour == IST hour
          line: "$lineNumber",
        },
      },
      {
        $match: {
          hour: { $gte: 9, $lte: 19 },
        },
      },
      {
        $group: {
          _id: { day: "$day", line: "$line", hour: "$hour" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { day: "$_id.day", line: "$_id.line" },
          slots: {
            $push: {
              k: { $concat: [{ $toString: "$_id.hour" }, ":00"] },
              v: "$count",
            },
          },
          lineTotal: { $sum: "$count" },
        },
      },
      {
        $group: {
          _id: "$_id.day",
          lines: {
            $push: {
              lineNumber: "$_id.line",
              hourlySlots: "$slots",
              total: "$lineTotal",
            },
          },
          dayTotal: { $sum: "$lineTotal" },
        },
      },
      {
        $sort: { _id: 1 }, // sort by day ascending
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          lines: {
            $map: {
              input: "$lines",
              as: "ln",
              in: {
                lineNumber: "$$ln.lineNumber",
                hourlyCount: { $arrayToObject: "$$ln.hourlySlots" },
                total: "$$ln.total",
              },
            },
          },
          total: "$dayTotal",
        },
      },
    ]);

    const formatted = agg.map(({ date, lines, total }) => {
      const formattedLines = lines.map(
        ({ lineNumber, hourlyCount, total: lineTotal }) => {
          const obj = { lineNumber };
          for (let h = 9; h <= 19; h++) {
            const key = `${h}:00`;
            obj[key] = hourlyCount[key] || 0;
          }
          obj.total = lineTotal;
          return obj;
        }
      );
      return { date, total, lines: formattedLines };
    });

    return res.status(200).json({
      message: "Daily Hourly Tray Counts by WorkOrder",
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching daily tray counts:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const cutQty = async (req, res) => {
  try {
    const { workOrderID } = req.body;
    if (!mongoose.Types.ObjectId.isValid(workOrderID)) {
      return res.status(400).json({ message: "Invalid workOrderID." });
    }

    const aggregation = await CutSheet.aggregate(
      [
        { $match: { workOrderID: new mongoose.Types.ObjectId(workOrderID) } },
        {
          $group: {
            _id: { color: "$color", size: "$sizes" },
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ],
      { allowDiskUse: true }
    ).exec();

    if (!aggregation.length) {
      return res.json({ columns: ["Color"], rows: [] });
    }

    const allColorsSet = new Set();
    const allSizesSet = new Set();
    aggregation.forEach((doc) => {
      allColorsSet.add(doc._id.color);
      allSizesSet.add(doc._id.size);
    });

    const allColors = Array.from(allColorsSet).sort();
    const allSizes = Array.from(allSizesSet).sort((a, b) => a.localeCompare(b));

    const tableData = Object.create(null);
    allColors.forEach((color) => {
      const sizeMap = Object.create(null);
      allSizes.forEach((size) => {
        sizeMap[size] = 0;
      });
      tableData[color] = sizeMap;
    });

    const colTotals = Object.create(null);
    allSizes.forEach((size) => {
      colTotals[size] = 0;
    });

    aggregation.forEach((doc) => {
      const { color, size } = doc._id;
      const qty = doc.totalQuantity;
      if (tableData[color] && tableData[color][size] !== undefined) {
        tableData[color][size] = qty;
        colTotals[size] += qty;
      }
    });

    const rowTotals = Object.create(null);
    let grandTotal = 0;
    allColors.forEach((color) => {
      let sum = 0;
      allSizes.forEach((size) => {
        sum += tableData[color][size];
      });
      rowTotals[color] = sum;
      grandTotal += sum;
    });

    const columns = ["Color", ...allSizes, "Total"];
    const rows = allColors.map((color) => {
      const rowObj = { color };
      allSizes.forEach((size) => {
        rowObj[size] = tableData[color][size];
      });
      rowObj.Total = rowTotals[color];
      return rowObj;
    });

    const totalsRow = { color: "Total" };
    allSizes.forEach((size) => {
      totalsRow[size] = colTotals[size];
    });
    totalsRow.Total = grandTotal;
    rows.push(totalsRow);

    return res.json({ columns, rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getColorSizeTrayCountsByWorkOrder = async (req, res) => {
  const companyId = req.user.companyID;
  const { workOrderId } = req.body;

  try {
    // 1) Validate inputs
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error("Invalid companyId format");
    }
    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
      throw new Error("Invalid workOrderId format");
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const workOrderObjectId = new mongoose.Types.ObjectId(workOrderId);

    // 2) Aggregate counts grouped by color and size (no date filter)
    //    Only include trays that have a completedAt timestamp (i.e. completed)
    const agg = await Tray.aggregate([
      {
        $match: {
          companyId: companyObjectId,
          workOrder: workOrderObjectId,
          completedAt: { $exists: true, $ne: null },
        },
      },
      {
        // First group: by (color, size) to count how many trays of each combination
        $group: {
          _id: { color: "$color", size: "$size" },
          count: { $sum: 1 },
        },
      },
      {
        // Second group: by color, aggregate size‐counts and sum a colorTotal
        $group: {
          _id: "$_id.color",
          slots: {
            $push: {
              k: "$_id.size",
              v: "$count",
            },
          },
          colorTotal: { $sum: "$count" },
        },
      },
      {
        // Project into { color, sizeCounts: { sizeName: count, … }, colorTotal }
        $project: {
          _id: 0,
          color: "$_id",
          sizeCounts: { $arrayToObject: "$slots" },
          colorTotal: 1,
        },
      },
      {
        // Sort by color ascending (optional)
        $sort: { color: 1 },
      },
    ]);

    // 3) If no data for that workOrder, return empty structure
    if (agg.length === 0) {
      return res.status(200).json({
        message: `No completed trays found for workOrder ${workOrderId}`,
        columns: ["Color/Size", "Total"],
        rows: [],
      });
    }

    // 4) Build a set of all sizes encountered across all colors
    const sizeSet = new Set();
    agg.forEach(({ sizeCounts }) => {
      Object.keys(sizeCounts).forEach((sz) => sizeSet.add(sz));
    });
    // Convert to sorted array of sizes (e.g. ["M", "L", "XL", "2XL", …])
    const sizes = Array.from(sizeSet).sort((a, b) => {
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    // 5) Build columns array: ["Color/Size", <size1>, <size2>, …, "Total"]
    const columns = ["Color/Size", ...sizes, "Total"];

    // 6) Build each row: { "Color/Size": color, <sizeKey>: count, …, Total: colorTotal }
    const rows = agg.map(({ color, sizeCounts, colorTotal }) => {
      const row = { "Color/Size": color };
      sizes.forEach((sz) => {
        row[sz] = sizeCounts[sz] || 0;
      });
      row.Total = colorTotal;
      return row;
    });

    // 7) Build a final "Total" row summing across all colors
    const totalRow = { "Color/Size": "Total" };
    let grandTotal = 0;
    sizes.forEach((sz) => {
      let sumForSize = 0;
      agg.forEach(({ sizeCounts }) => {
        sumForSize += sizeCounts[sz] || 0;
      });
      totalRow[sz] = sumForSize;
      grandTotal += sumForSize;
    });
    totalRow.Total = grandTotal;

    rows.push(totalRow);

    // 8) Return the result
    return res.status(200).json({
      message: `Tray counts by color & size for workOrder ${workOrderId}`,
      columns,
      rows,
    });
  } catch (error) {
    console.error("Error fetching color/size tray counts:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getColorSizeTrayFeedingCount = async (req, res) => {
  const companyId = req.user.companyID;
  const { workOrderId } = req.body; // expecting { workOrderId: "..." }

  try {
    // 1) Validate inputs
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error("Invalid companyId format");
    }
    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
      throw new Error("Invalid workOrderId format");
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const workOrderObjectId = new mongoose.Types.ObjectId(workOrderId);

    // 2) Aggregate: count feeding (no completedAt) and completed (has completedAt), then sum total = feeding + completed
    const agg = await Tray.aggregate([
      {
        $match: {
          companyId: companyObjectId,
          workOrder: workOrderObjectId,
        },
      },
      {
        // Group by { color, size } to compute feeding vs completed counts
        $group: {
          _id: { color: "$color", size: "$size" },
          feedingCount: {
            $sum: {
              $cond: [
                { $ifNull: ["$completedAt", false] }, // if completedAt exists → true
                0, // then feeding 0
                1, // else feeding 1
              ],
            },
          },
          completedCount: {
            $sum: {
              $cond: [
                { $ifNull: ["$completedAt", false] }, // if completedAt exists → true
                1, // then completed 1
                0, // else completed 0
              ],
            },
          },
        },
      },
      {
        // Add a "total" field = feedingCount + completedCount
        $addFields: {
          totalCount: { $add: ["$feedingCount", "$completedCount"] },
        },
      },
      {
        // Next group: by color, collect each size→totalCount, and sum a colorTotal
        $group: {
          _id: "$_id.color",
          slots: {
            $push: {
              k: "$_id.size",
              v: "$totalCount",
            },
          },
          colorTotal: { $sum: "$totalCount" },
        },
      },
      {
        // Project into shape { color, sizeCounts: { size: totalCount, ... }, colorTotal }
        $project: {
          _id: 0,
          color: "$_id",
          sizeCounts: { $arrayToObject: "$slots" },
          colorTotal: 1,
        },
      },
      {
        // (Optional) Sort rows by color name ascending
        $sort: { color: 1 },
      },
    ]);

    // 3) If no documents matched, return an empty structure
    if (agg.length === 0) {
      return res.status(200).json({
        message: `No trays found for workOrder ${workOrderId}`,
        columns: ["Color/Size", "Total"],
        rows: [],
      });
    }

    // 4) Build a set of all sizes encountered
    const sizeSet = new Set();
    agg.forEach(({ sizeCounts }) => {
      Object.keys(sizeCounts).forEach((sz) => sizeSet.add(sz));
    });
    // Convert to sorted array of sizes (e.g. ["M", "L", "XL", "2XL", ...])
    const sizes = Array.from(sizeSet).sort((a, b) => {
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    // 5) Build columns: ["Color/Size", <size1>, <size2>, …, "Total"]
    const columns = ["Color/Size", ...sizes, "Total"];

    // 6) Build rows: one row per color, with each size’s totalCount, plus a “Total” column
    const rows = agg.map(({ color, sizeCounts, colorTotal }) => {
      const row = { "Color/Size": color };
      sizes.forEach((sz) => {
        row[sz] = sizeCounts[sz] || 0;
      });
      row.Total = colorTotal;
      return row;
    });

    // 7) Build the final “Total” row by summing across all colors
    const totalRow = { "Color/Size": "Total" };
    let grandTotal = 0;
    sizes.forEach((sz) => {
      let sumForSize = 0;
      agg.forEach(({ sizeCounts }) => {
        sumForSize += sizeCounts[sz] || 0;
      });
      totalRow[sz] = sumForSize;
      grandTotal += sumForSize;
    });
    totalRow.Total = grandTotal;
    rows.push(totalRow);

    // 8) Return the pivoted table structure
    return res.status(200).json({
      message: `Feeding + Completed Tray Counts by Color & Size for workOrder ${workOrderId}`,
      columns,
      rows,
    });
  } catch (error) {
    console.error("Error fetching feeding/completed tray counts:", error);
    return res.status(500).json({ error: error.message });
  }
};

let _trayCache = null;
let _trayCacheTs = 0;

export const trayStatus = expressAsyncHandler(async (req, res) => {
  const nowMs = Date.now();

  // — If cached and <5 minutes old, return that immediately:
  if (_trayCache && nowMs - _trayCacheTs < 5 * 60 * 1000) {
    return res.type("application/json").send(_trayCache);
  }

  // — Otherwise, recompute …

  // 1) Compute IST‐today window (00:00 IST → 24:00 IST)
  const nowIst = new Date(nowMs + IST_OFFSET);
  const year = nowIst.getFullYear();
  const month = nowIst.getMonth();
  const day = nowIst.getDate();

  // use UTC‐based constructor so that toISOString() still shows Z,
  // but we're marking midnight IST
  const startOfDayIst = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const endOfDayIst = new Date(startOfDayIst.getTime() + 24 * 60 * 60 * 1000);

  // 2) Aggregation pipeline
  const pipeline = [
    {
      $match: {
        $or: [
          { assignedAt: { $gte: startOfDayIst, $lt: endOfDayIst } },
          { completedAt: { $gte: startOfDayIst, $lt: endOfDayIst } },
        ],
      },
    },
    {
      $group: {
        _id: "$lineNumber",
        input: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$assignedAt", startOfDayIst] },
                  { $lt: ["$assignedAt", endOfDayIst] },
                ],
              },
              1,
              0,
            ],
          },
        },
        output: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$completedAt", startOfDayIst] },
                  { $lt: ["$completedAt", endOfDayIst] },
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
        _id: 0,
        lineNumber: {
          $cond: [
            { $eq: ["$_id", 3] },
            "LINE4",
            { $concat: ["LINE", { $toString: "$_id" }] },
          ],
        },
        input: 1,
        output: 1,
      },
    },
    { $sort: { lineNumber: 1 } },
  ];

  const data = await Tray.aggregate(pipeline);

  // 3) Cache and return
  const payload = JSON.stringify({ data });
  _trayCache = payload;
  _trayCacheTs = nowMs;

  res.type("application/json").send(payload);
});
