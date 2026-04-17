const Attendance = require("../models/Attendance");
const dayjs = require("dayjs");
const User = require("../models/User");
const Setting = require("../models/Setting");
const getDistance = require("../utils/distance");
const exportExcel = require("../utils/excelExport");

exports.punchIn = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Location required" });
    }

    const setting = await Setting.findOne();
    if (!setting)
      return res.status(500).json({ message: "Office not configured" });

    const dist = getDistance(setting.officeLat, setting.officeLng, lat, lng);
    if (dist > setting.allowedRadius) {
      return res.status(403).json({ message: "Outside office area" });
    }

    const today = dayjs().format("YYYY-MM-DD");
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const existing = await Attendance.findOne({
      user: req.user._id,
      date: today
    });

    if (existing && existing.punchIn) {
      return res.status(400).json({ message: "Already punched in" });
    }

    const now = new Date();
    const status = now.getHours() > 10 ? "late" : "present";

    const record = await Attendance.findOneAndUpdate(
      { user: req.user._id, date: today },
      {
        $set: {
          punchIn: now,
          status,
          ipAddress: ip,
          location: { lat, lng }
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, record });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Punch failed" });
  }
};


exports.punchOut = async (req, res) => {
  const today = dayjs().format("YYYY-MM-DD");

  const record = await Attendance.findOne(
    { user: req.user._id, date: today },
    { punchOut: new Date() },
    { new: true }
  );

  if (!record || !record.punchIn)
    return res.status(400).json({ message: "Punch in first" });

  if (record.punchOut)
    return res.status(400).json({ message: "Already punched out" });

  const now = new Date();

  const hours = (now.getTime() - record.punchIn.getTime()) / (1000 * 60 * 60);

  record.punchOut = now;
  record.totalHours = Number(hours.toFixed(2));

  await record.save();

  res.json({ success: true, record });
};

exports.myAttendance = async (req, res) => {
  const { month, year } = req.query;

  let filter = { user: req.user._id };

  if(month && year){
    const start = new Date(year, month-1, 1);
    const end = new Date(year, month, 1);

    filter.punchIn = { $gte: start, $lt: end };
  }

  const data = await Attendance.find(filter).sort({ punchIn: -1 });
  res.json(data);
};

exports.teamAttendance = async (req, res) => {
  // only manager allowed
  if (req.user.role !== "manager")
    return res.status(403).json({ message: "Access denied" });

  const executives = await User.find({
    role: "executive",
    assignedManager: req.user._id,
    isActive: true,
  }).select("_id");

  const execIds = executives.map((e) => e._id);

  const records = await Attendance.find({
    user: { $in: execIds },
  })
    .sort({ date: -1 })
    .populate("user", "name role");

  res.json(records);
};

exports.allAttendance = async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  const data = await Attendance.find()
    .populate("user", "name email role")
    .sort({ date: -1 });

  res.json(data);
};

exports.deleteAttendance = async(req,res)=>{
  await Attendance.findByIdAndDelete(req.params.id);
  res.json({ message:"Attendance deleted" });
};

exports.exportAttendanceExcel = async(req,res)=>{
  const data = await Attendance.find().populate("user","name");

  const file = exportExcel(data);

  res.setHeader("Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition","attachment; filename=attendance.xlsx");

  res.send(file);
};
