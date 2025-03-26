import mongoose from "mongoose";
import Costing from "../Model/costingModel.js";
import Emp from "../Model/EmpModel.js";
import Order from "../Model/orderModel.js";

export const getAllEmp = async (req, res) => {
  try {
    const companyId = req.user.companyID;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const employees = await Emp.find({ companyId });

    if (!employees.length) {
      return res
        .status(404)
        .json({ message: "No employees found for this company" });
    }

    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const orderByID = async (req, res) => {
  try {
    const companyId = req.user.companyID;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const orders = await Order.find({ companyId }).select(
      "_id orderName orderNumber"
    );

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for this company" });
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addCosting = async (req, res) => {
  try {
    const companyId = req.user.companyID;
    const { empArr, lineNumber, totalCost, hourlyCost, workOrder } = req.body;
    const newReport = new Costing({
      empArr,
      lineNumber,
      totalCost,
      hourlyCost,
      workOrder,
      companyId,
    });
    await newReport.save();
    res.status(200).json({
      message: "Added new report.",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCosting = async (req, res) => {
  const companyId = req.user.companyID;
  try {
    const costing = await Costing.find({ companyId });
    if (!costing.length) {
      return res
        .status(404)
        .json({ message: "No costing found for this company" });
    }

    res.status(200).json(costing);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const outputProductionReportMonth = async (req, res) => {
    
  const companyId = req.user.companyID;
  const { date } = req.body; 

  try {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error("Invalid companyId format");
    }

    const selectedDate = date ? new Date(date) : new Date();
    const year = selectedDate.getUTCFullYear();
    const month = selectedDate.getUTCMonth(); 

    const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const orders = await Order.find({ companyId }).lean();
    const dailyReports = {};

    orders.forEach((order) => {
      order.orderCutSheet.forEach((cutSheet) => {
        cutSheet.pieces.forEach((piece) => {
          if (piece.status === "Output" && piece.lineNumber) {
            const updatedAt = new Date(piece.updatedAt);

            if (updatedAt >= monthStart && updatedAt <= monthEnd) {
              const dayKey = updatedAt.toISOString().slice(0, 10);
              if (!dailyReports[dayKey]) {
                dailyReports[dayKey] = { hourlyCount: {}, dailyCount: 0 };
              }

              const hour = updatedAt.getUTCHours();
              const hourRange = `${hour}:00-${hour}:59`;
              const line = piece.lineNumber;

              if (!dailyReports[dayKey].hourlyCount[line]) {
                dailyReports[dayKey].hourlyCount[line] = {};
              }
           
              if (!dailyReports[dayKey].hourlyCount[line][hourRange]) {
                dailyReports[dayKey].hourlyCount[line][hourRange] = 0;
              }
          
              dailyReports[dayKey].hourlyCount[line][hourRange]++;
              dailyReports[dayKey].dailyCount++;
            }
          }
        });
      });
    });

    Object.keys(dailyReports).forEach((dayKey) => {
      const hourlyCount = dailyReports[dayKey].hourlyCount;
      Object.keys(hourlyCount).forEach((line) => {
        const total = Object.values(hourlyCount[line]).reduce(
          (sum, count) => sum + count,
          0
        );
        hourlyCount[line]["Total"] = total;
      });
    });
   
    const reportArray = Object.keys(dailyReports)
      .sort() 
      .map((day) => ({
        date: day,
        hourlyCount: dailyReports[day].hourlyCount,
        dailyCount: dailyReports[day].dailyCount,
      }));

    res.status(201).json({ message: "Production Report", report: reportArray });
  } catch (error) {
    console.error("Error fetching output count:", error);
    res.status(500).json({ error: error.message });
  }
};
