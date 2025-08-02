import { ScanEventSW } from "../Model/RfidModels.js";

export const getDailyOperationCounts = async (req, res, next) => {
  try {
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
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    console.log(startOfDay, endOfDay);

    // 3) Run the aggregation exactly as before
    const results = await ScanEventSW.aggregate([
      {
        $match: {
          scannedAt: {
            $gte: startOfDay,
            $lt: endOfDay,
          },
        },
      },
      {
        $lookup: {
          from: "operations",
          localField: "operation",
          foreignField: "_id",
          as: "op",
        },
      },
      { $unwind: "$op" },
      {
        $group: {
          _id: "$op.name",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          operation: "$_id",
          count: 1,
        },
      },
      { $sort: { operation: 1 } },
    ]);

    return res.json(results);
  } catch (err) {
    return next(err);
  }
};
