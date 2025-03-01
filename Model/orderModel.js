import mongoose from "mongoose";

// Schema for individual pieces
const pieceSchema = new mongoose.Schema(
  {
    pieceId: {
      type: Number, // Unique ID for each piece
      required: true,
    },
    sizes: {
      type: String, // Size of the piece (e.g., M, L, XL, XXL)
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    status: {
      type: String, // Status of the piece
      required: true,
      enum: ["Store", "In-Line", "Finishing", "In-Feeding", "Output"],
      default: "Store",
    },
    lineNumber: {
      type: String,
      enum: [
        "Line-1",
        "Line-2",
        "Line-3",
        "Line-4",
        "Line-5",
        "Line-6",
        "Line-7",
        "Line-8",
        "Line-9",
        "Line-10",
        "Line-11",
        "Line-12",
        "Line-13",
        "Line-14",
        "Line-15",
        "Line-16",
        "Line-17",
        "Line-18",
        "Line-19",
        "Line-20",
      ],
    },
    trayQrCode: {
      type: String,
      required: false,
      unique: true,
    },
  },
  { timestamps: true }
);

// Schema for cut sheets
const orderCutSheetSchema = new mongoose.Schema({
  orderName: {
    type: String,
    required: true,
    default: "Untitled Form",
  },
  color: {
    type: String,
    required: true,
  },
  orderNumber: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  sizes: {
    type: String,
    required: true,
  },
  qrCode: {
    type: String,
  },
  pieces: [pieceSchema],
});

// Main order schema
const orderSchema = new mongoose.Schema(
  {
    orderCutSheet: {
      type: [orderCutSheetSchema],
      default: [],
    },
    orderName: {
      type: String,
      required: true,
      default: "Untitled Form",
    },
    styleNumber: {
      type: String,
      required: true,
    },
    orderDiscription: {
      type: String,
      required: true,
    },
    orderNumber: {
      type: Number,
      required: true,
    },
    combinedQuantities: {
      type: Map,
      of: Number,
      required: true,
    },
    sizes: {
      type: [String], // Stores the available sizes in this order, e.g., ["M", "L", "XL", "XXL"]
      required: true,
    },
    colous: {
      type: [String],
      required: true,
    },
    cutcombinedQuantities: {
      type: Map,
      of: Number,
    },
    excessQuantity: {
      type: Number,
      required: true,
    },
    excessPercentage: {
      type: Number,
      required: true,
    },
    orderQuantity: {
      type: Number,
      required: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "company",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
