import mongoose from "mongoose";

const qualitySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "company",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "order",
    },
  },
  { timestamps: true }
);

const Quality = mongoose.model("Quality", qualitySchema);
export default Quality;
