import mongoose from "mongoose";

const productionRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: () => new Date()
  },
  pieces: {
    type: Number,
    required: true,
    min: 0
  },
  incentive: {
    type: Number,
    required: true,
    min: 0
  },
  lineNumber:{
    type: String,
    required: true,
  },
  target:{
    type: Number,
    required: true,
  },
}, { _id: false });  

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
  },
  password:{
    type: Number,
    required: true,
    default: 123456,
  },
  productionRecords: {
    type: [productionRecordSchema],
    default: []
  }
});

const Emp = mongoose.model("Emp", empSchema);
export default Emp;
