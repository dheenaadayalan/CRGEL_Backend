import mongoose from "mongoose";

// Schema for individual pieces
const pieceSchema = new mongoose.Schema(
  {
    pieceId: {
      type: Number, // Unique ID for each piece
      required: true,
    },
    status: {
      type: String, // Status of the piece
      required: true,
      enum: ["Store", "In-Line", "Finishing", "In-Feeding", "Output"],
      default: "Store",
    },
    sizes: {
      type: String, // Size of the piece (e.g., M, L, XL, XXL)
      required: true,
    },
    color: {
      type: String,
      required: true,
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
  lot: {
    type: String,
    // required: true,
  },
  shade: {
    type: String,
    //required: true,
  },
  color: {
    type: String,
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
  isPrinted: {
    type: Boolean,
    default: false,
  },
  pieces: [pieceSchema],
});

const inputDataSchema = new mongoose.Schema(
  {
    M: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    XL: { type: Number, default: 0 },
    XXL: { type: Number, default: 0 },
    XXXL:{type: Number, default: 0}
  },
  { _id: false }
);

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
    inputData: {
      type: Map,
      of: new mongoose.Schema(
        {
          lineNumbers: { type: Map, of: inputDataSchema, default: {} },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
