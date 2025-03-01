import mongoose from "mongoose";

const qrCodeDeviceSchema = new mongoose.Schema(
  {
    deviceName: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    roles: {
      type: String,
      required: true,
      enum: ["Store", "In-Line", "Finishing", "In-Feeding","Output","Barcode"],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "company",
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
  },
  { timestamps: true }
);

const QrCodeDevice = mongoose.model("QrCodeDevice", qrCodeDeviceSchema);

export default QrCodeDevice;
