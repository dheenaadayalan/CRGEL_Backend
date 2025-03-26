import mongoose from "mongoose";

const costingSchema = new mongoose.Schema(
  {
    empArr: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
      ref: "Emp",
    },
    lineNumber: {
      type: String,
      required: true,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    hourlyCost: {
      type: Number,
      required: true,
    },
    workOrder: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "company",
    },
  },
  { timestamps: true }
);

const Costing = mongoose.model("Costing", costingSchema);
export default Costing;
