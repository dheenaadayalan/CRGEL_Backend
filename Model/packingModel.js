import mongoose from "mongoose";

const orderPackedSchema = new mongoose.Schema({
  barcode: {
    type: String,
  },
  count: {
    type: Number,
  },
  size: {
    type: String,
  },
  colour: {
    type: String,
  },
});

const packingSchema = new mongoose.Schema({
  orderPackingInfo: {
    type: [orderPackedSchema],
    default: [],
  },
});

const Packing = mongoose.model("Packing", packingSchema);
export default Packing;
