import mongoose from "mongoose";
const { Schema } = mongoose;

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function istDatePlugin(schema) {
  schema.pre("save", function (next) {
    for (let key of Object.keys(schema.paths)) {
      const pathType = schema.paths[key];
      if (pathType.instance === "Date" && this[key]) {
        // shift UTC date by IST offset
        const d = new Date(this[key]);
        this[key] = new Date(d.getTime() + IST_OFFSET);
      }
    }
    next();
  });

  schema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate() || {};
    if (update.$set) {
      Object.keys(schema.paths).forEach((pathName) => {
        const pathType = schema.paths[pathName];
        if (pathType.instance === "Date" && update.$set[pathName]) {
          const d = new Date(update.$set[pathName]);
          update.$set[pathName] = new Date(d.getTime() + IST_OFFSET);
        }
      });
    }
    next();
  });
}

const WorkOrderSchema = new Schema({
  workOrderNo: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true },
  colors: [String],
  sizes: [String],
  dueDate: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + IST_OFFSET),
  },
  combinedQuantities: { type: Map, of: Number, required: true },
  cutcombinedQuantities: { type: Map, of: Number },
  createdAt: { type: Date, default: Date.now },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
});
WorkOrderSchema.plugin(istDatePlugin);

const OperationSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    sequence: { type: Number, required: true },
    workOrder: { type: Schema.Types.ObjectId, ref: "WorkOrder" },
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  },
  { timestamps: true }
);
OperationSchema.plugin(istDatePlugin);

const MachineSchema = new Schema(
  {
    machineId: { type: String, required: true, unique: true },
    operation: {
      type: Schema.Types.ObjectId,
      ref: "Operation",
      required: true,
    },
    lineNumber: { type: Number, required: true },
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  },
  { timestamps: true }
);
MachineSchema.plugin(istDatePlugin);

const TraySchema = new Schema({
  rfidTag: { type: String, required: true },
  workOrder: { type: Schema.Types.ObjectId, ref: "WorkOrder", required: true },
  color: { type: String, required: true },
  size: { type: String, required: true },
  lineNumber: { type: Number, required: true },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  assignedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  needleRoomInTime: { type: Date },
  packingAtTime: { type: Date },
  checking: [{ step: { type: Number }, passed: { type: Boolean } }],
});
TraySchema.plugin(istDatePlugin);

const TraySWSchema = new Schema({
  workOrder: { type: Schema.Types.ObjectId, ref: "WorkOrder", required: true },
  color: { type: String, required: true },
  size: { type: String, required: true },
  lineNumber: { type: Number, required: true },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  assignedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  needleRoomInTime: { type: Date },
  packingAtTime: { type: Date },
  checking: [{ step: { type: Number }, passed: { type: Boolean } }],
});
TraySWSchema.plugin(istDatePlugin);

const OperatorSchema = new Schema({
  operatorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  loginAt: { type: Date, required: true, default: Date.now },
  logoutAt: { type: Date },
});
OperatorSchema.plugin(istDatePlugin);

const ScanEventSchema = new Schema({
  tray: { type: Schema.Types.ObjectId, ref: "Tray", required: true },
  machine: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
  operator: { type: Schema.Types.ObjectId, ref: "Operator", required: true },
  operation: { type: Schema.Types.ObjectId, ref: "Operation", required: true },
  workOrder: { type: Schema.Types.ObjectId, ref: "WorkOrder", required: true },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  scannedAt: { type: Date, default: Date.now },
});
ScanEventSchema.plugin(istDatePlugin);

const ScanEventSWSchema = new Schema({
  machine: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
  operator: { type: Schema.Types.ObjectId, ref: "Operator", required: true },
  operation: { type: Schema.Types.ObjectId, ref: "Operation", required: true },
  workOrder: { type: Schema.Types.ObjectId, ref: "WorkOrder", required: true },
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "company" },
  scannedAt: { type: Date, default: Date.now },
});
ScanEventSWSchema.plugin(istDatePlugin);

const CutSheetSchema = new Schema({
  workOrderID: {
    type: Schema.Types.ObjectId,
    ref: "WorkOrder",
    required: true,
  },
  workOrderNo:{ type: Number, required: true },
  color: { type: String, required: true },
  sizes: { type: String, required: true },
  quantity: { type: Number, required: true },
  lot: { type: String },
  shade: { type: String },
  qrCode: { type: String }, 
  bundelNo:{type: Number, unique:true},
  isPrinted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
CutSheetSchema.plugin(istDatePlugin);

export const WorkOrder = mongoose.model("WorkOrder", WorkOrderSchema);
export const CutSheet = mongoose.model("CutSheet", CutSheetSchema);
export const Operation = mongoose.model("Operation", OperationSchema);
export const Machine = mongoose.model("Machine", MachineSchema);
export const Tray = mongoose.model("Tray", TraySchema);
export const TraySW = mongoose.model("TraySW", TraySWSchema);
export const Operator = mongoose.model("Operator", OperatorSchema);
export const ScanEvent = mongoose.model("ScanEvent", ScanEventSchema);
export const ScanEventSW = mongoose.model("ScanEventSW", ScanEventSWSchema);