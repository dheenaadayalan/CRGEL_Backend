import mongoose from "mongoose";

const empSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "company",
  },
  name:{
    type: String,
    required: true,
  },
  empID:{
    type: Number,
    required: true,
  },
  netPay:{
    type: Number,
    required: true,
  }
});

const Emp = mongoose.model("Emp", empSchema);
export default Emp;
