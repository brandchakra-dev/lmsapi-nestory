const pushService = require('../services/push.service');
const User = require('../models/User');
const Lead = require("../models/Lead");

// ✅ Create Lead
exports.createLead = async (req, res, next) => {
  try {
    const user = req.user;

    // ❌ Executive cannot create
    if (user.role === "executive") {
      return res
        .status(403)
        .json({ message: "Executives cannot create leads" });
    }

    const payload = {
      ...req.body,
      createdBy: user._id,
      assignedManager:
        user.role === "manager" ? user._id : req.body.assignedManager || null,
    };

    // ✅ Manager auto assign himself
    if (user.role === "manager") {
      payload.assignedManager = user._id;
    }

    const lead = await Lead.create(payload);

    // 🔔 Notify Manager
if (lead.assignedManager &&
  lead.assignedManager.toString() !== req.user._id.toString()) {
  const manager = await User.findById(lead.assignedManager);

  if (manager?.pushToken) {
     pushService.sendPushNotification(
      manager.pushToken,
      "📌 New Lead Assigned",
      `New lead created: ${lead.name}`,
      {
        type: "lead_created",
        leadId: lead._id,
      }
    ).catch(console.error);
  }
}

// 🔔 Notify Executive
if (lead.assignedExecutive &&
  lead.assignedExecutive.toString() !== req.user._id.toString()) {
  const executive = await User.findById(lead.assignedExecutive);

  if (executive?.pushToken) {
     pushService.sendPushNotification(
      executive.pushToken,
      "🎯 New Lead Assigned",
      `You have been assigned lead: ${lead.name}`,
      {
        type: "lead_created",
        leadId: lead._id,
      }
    ).catch(console.error);
  }
}

    const io = req.app.get("io");
    if (io) io.emit("lead:created", lead);

    res.status(201).json(lead);
  } catch (e) {
    next(e);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const user = req.user;

    // 🔒 permission checks
    if (
      user.role === "manager" &&
      lead.assignedManager?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Not your lead" });
    }

    if (
      user.role === "executive" &&
      lead.assignedExecutive?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Not your lead" });
    }

    // ===============================
    // 🧠 STORE OLD ASSIGNMENTS
    // ===============================
    const oldExecutive = lead.assignedExecutive?.toString();
    const oldManager = lead.assignedManager?.toString();

    // ===============================
    // ✏️ UPDATE LEAD
    // ===============================
    Object.assign(lead, req.body);
    lead.updatedAt = new Date();

    await lead.save();

    // ===============================
    // 🚀 NOTIFICATION LOGIC
    // ===============================

    // // 🔔 Executive assignment changed
    // if (
    //   req.body.assignedExecutive &&
    //   req.body.assignedExecutive !== oldExecutive &&
    //   req.body.assignedExecutive !== req.user._id.toString()
    // ) {
    //   const executive = await User.findById(req.body.assignedExecutive);

    //   console.log("📤 Sending push to:", executive?.pushToken);

    //   if (executive?.pushToken) {
    //      pushService.sendPushNotification(
    //       executive.pushToken,
    //       "🎯 New Lead Assigned",
    //       `You have been assigned lead: ${lead.name}`,
    //       {
    //         type: "lead_assigned",
    //         leadId: lead._id,
    //       }
    //     ).catch(console.error);
    //   }
    // }

    // // 🔔 Manager assignment changed
    // if (
    //   req.body.assignedManager &&
    //   req.body.assignedManager !== oldManager &&
    //   req.body.assignedManager !== req.user._id.toString()
    // ) {
    //   const manager = await User.findById(req.body.assignedManager);

    //   if (manager?.pushToken) {
    //      pushService.sendPushNotification(
    //       manager.pushToken,
    //       "📌 Lead Assigned",
    //       `A lead has been assigned to you ${lead.name}`,
    //       {
    //         type: "lead_assigned",
    //         leadId: lead._id,
    //       }
    //     ).catch(console.error);
    //   }
    // }

    setTimeout(async () => {
      if (
            req.body.assignedExecutive &&
            req.body.assignedExecutive !== oldExecutive &&
            req.body.assignedExecutive !== req.user._id.toString()
          ) {
            const executive = await User.findById(req.body.assignedExecutive);

            console.log("📤 Sending push to:", executive?.pushToken);

            if (executive?.pushToken) {
              pushService.sendPushNotification(
                executive.pushToken,
                "🎯 New Lead Assigned",
                `You have been assigned lead: ${lead.name}`,
                {
                  type: "lead_assigned",
                  leadId: lead._id,
                }
              ).catch(console.error);
            }
          }
    }, 0);

    res.json(lead);
  } catch (e) {
    next(e);
  }
};


// ✅ Get All Leads (role-based)
exports.getLeads = async (req, res, next) => {
  try {
    const { role, _id } = req.user;
    let query = {};

    if (role === "admin" || role === "superadmin") query = {};
    else if (role === "manager") query = { assignedManager: _id };
    else if (role === "executive") query = { assignedExecutive: _id };

    const leads = await Lead.find(query)
      .populate(
        "assignedManager assignedExecutive createdBy followUps.createdBy remarks.createdBy"
      )
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (e) {
    next(e);
  }
};

// ✅ Get Single Lead
exports.getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id).populate(
      "assignedManager assignedExecutive createdBy followUps.createdBy remarks.createdBy"
    );

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    res.json(lead);
  } catch (e) {
    next(e);
  }
};

// ✅ Assign Manager
exports.assignToManager = async (req, res, next) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Assign Manager:- Access denied" });
    }

    const { leadId } = req.params;
    const { managerId } = req.body;

    const existingLead = await Lead.findById(leadId);
    const oldManager = existingLead?.assignedManager?.toString();

    const lead = await Lead.findByIdAndUpdate(
      leadId,
      {
        assignedManager: managerId,
        assignedExecutive: null, // reset exec
        updatedAt: new Date(),
      },
      { new: true }
    );

    const manager = await User.findById(managerId);

      if ( manager?.pushToken &&
          managerId !== req.user._id.toString() &&
          managerId !== oldManager) {
         pushService.sendPushNotification(
          manager.pushToken,
          "📌 Lead Assigned",
          `A lead has been assigned to you`,
          {
            type: "lead_assigned",
            leadId: lead._id,
          }
        ).catch(console.error);
      }

    res.json(lead);
  } catch (e) {
    next(e);
  }
};

// ✅ Assign Executive
exports.assignToExecutive = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const { executiveId } = req.body;
    const user = req.user;

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // 🔐 Manager can assign only own leads
    if (
      user.role === "manager" &&
      lead.assignedManager?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Not your lead" });
    }

    lead.assignedExecutive = executiveId;
    lead.updatedAt = new Date();
    await lead.save();

    const executive = await User.findById(executiveId);

      if (executive?.pushToken &&
        executiveId !== req.user._id.toString()) {
         pushService.sendPushNotification(
          executive.pushToken,
          "🎯 New Lead Assigned",
          `You have been assigned lead: ${lead.name}`,
          {
            type: "lead_assigned",
            leadId: lead._id,
          }
        ).catch(console.error);
      }

    res.json(lead);
  } catch (e) {
    next(e);
  }
};

// ✅ Delete Lead
exports.deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "Lead Deleted", data: lead });
  } catch (error) {
    res.status(404).json({ success: false, message: "Lead Not Found" });
  }
};

exports.addFollowUp = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    lead.followUps.push({
      followUpAt: req.body.followUpAt,
      nextFollowUpDate: req.body.nextFollowUpDate || null,
      note: req.body.note,
      createdBy: req.user._id, // ✅ REQUIRED
    });

    await lead.save();
    res.json(lead);
  } catch (e) {
    next(e);
  }
};

// ✅ Add Remark - FIXED VERSION
exports.addRemark = async (req, res, next) => {
  try {
    const { id } = req.params; // lead ID
    const { remarkAt, text } = req.body; // ✅ FIXED: Correct field names

    // Validation
    if (!remarkAt) {
      return res.status(400).json({ message: "remarkAt is required" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // Push remark with correct field names
    lead.remarks.push({
      remarkAt: new Date(remarkAt), // ✅ Using remarkAt
      text: text.trim(),            // ✅ Using text
      createdBy: req.user._id,
      createdAt: new Date()
    });

    lead.updatedAt = new Date();
    await lead.save();

    // Populate createdBy for response
    await lead.populate("remarks.createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Remark added successfully",
      remark: lead.remarks[lead.remarks.length - 1]
    });
  } catch (e) {
    console.error("Error in addRemark:", e);
    next(e);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const user = req.user;

    // 🔐 Manager restriction
    if (
      user.role === "manager" &&
      lead.assignedManager?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Not your lead" });
    }

    // 🔐 Executive restriction
    if (
      user.role === "executive" &&
      lead.assignedExecutive?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Not your lead" });
    }

    // ✅ SAVE OLD STATUS FIRST
    const oldStatus = lead.status;

    // ✅ UPDATE STATUS
    lead.status = status;

    if (status === "inactive") {
      lead.inactiveReason = reason || "";
      lead.inactiveDate = new Date();
    }

    if (status === "booked") {
      lead.statusHistory.push({
        from: "booking",
        to: `Amount ₹${lead.bookingDetails?.bookingAmount || ""}`,
        reason: "Property booked",
        changedBy: user._id,
      });
    }

    // ✅ PROPER HISTORY
    lead.statusHistory.push({
      from: oldStatus,
      to: status,
      reason: reason || "",
      changedBy: user._id,
      date: new Date(),
    });

    await lead.save();

    const io = req.app.get("io");
    if (io) io.emit("lead:statusUpdated", lead);

    res.json(lead);
  } catch (e) {
    next(e);
  }
};


exports.getLeadTimeline = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("statusHistory.changedBy", "name role")
      .populate("followUps.createdBy", "name")
      .populate("remarks.createdBy", "name");

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const timeline = [];

    // status changes
    lead.statusHistory.forEach((s) => {
      timeline.push({
        type: "status",
        date: s.date,
        title: `Status changed: ${s.from} → ${s.to}`,
        description: s.reason || "",
        user: s.changedBy?.name,
      });
    });

    // followups
    lead.followUps.forEach((f) => {
      timeline.push({
        type: "followup",
        date: f.createdAt,
        title: "Follow-up Scheduled",
        description: `${new Date(f.followUpAt).toLocaleString()} — ${f.note}`,
        user: f.createdBy?.name,
      });
    });

    // remarks
    lead.remarks.forEach((r) => {
      timeline.push({
        type: "remark",
        date: r.createdAt,
        title: "Remark Added",
        description: r.text,
        user: r.createdBy?.name,
      });
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(timeline);
  } catch (e) {
    next(e);
  }
};

exports.getLeadStats = async (req, res, next) => {
  try {
    const user = req.user;

    let match = {};

    if (user.role === "manager") {
      match.assignedManager = user._id;
    }

    if (user.role === "executive") {
      match.assignedExecutive = user._id;
    }

    const stats = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // ✅ follow-up count (NEW LOGIC)
    const followupCountAgg = await Lead.aggregate([
      { $match: match },
      { $unwind: "$followUps" },
      {
        $match: {
          "followUps.followUpAt": { $gte: new Date() }, // upcoming
        },
      },
      { $count: "total" },
    ]);

    const followupCount = followupCountAgg[0]?.total || 0;

    const formatted = {
      total: 0,
      new: 0,
      active: 0,
      followup: followupCount,
      visited: 0,
      booked: 0,
      inactive: 0,
      closed: 0,
    };

    stats.forEach((s) => {
      formatted[s._id] = s.count;
    });

    res.json(formatted);
  } catch (e) {
    next(e);
  }
};

const validator = require("validator");

const ALLOWED_STATUS = [
  "new",
  "visited",
  "booked",
  "active",
  "inactive",
  "closed",
  "followup",
];

const ALLOWED_RESIDENCE = [
  "1 BHK",
  "2 BHK",
  "3 BHK",
  "4 BHK",
  "Villa",
  "Penthouse",
  "Plot",
  "Other",
];

exports.bulkImportLeads = async (req, res) => {
  try {
    // const leads = req.body.leads;
    const leads = req.body.leads.filter((l) =>
      Object.values(l).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== ""
      )
    );
    const userId = req.user?._id;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: "No leads provided" });
    }

    const validRows = [];
    const invalidRows = [];
    const duplicateFileRows = [];
    const duplicateDBRows = [];

    const seenPhone = new Set();
    const seenEmail = new Set();

    const phones = [];
    const emails = [];

    // ================= FILE VALIDATION =================
    leads.forEach((l, index) => {
      const row = index + 2;

      const name = l.name?.trim();
      const phone = l.phone?.trim();
      const email = l.email?.trim().toLowerCase();
      const status = (l.status || "new").toLowerCase();

      if (!name || name.length < 2) {
        invalidRows.push({ row, ...l, reason: "Invalid name" });
        return;
      }

      if (!phone) {
        invalidRows.push({ row, ...l, reason: "Phone is required" });
        return;
      }

      if (email && !validator.isEmail(email)) {
        invalidRows.push({ row, ...l, reason: "Invalid email" });
        return;
      }

      if (!ALLOWED_STATUS.includes(status)) {
        invalidRows.push({ row, ...l, reason: "Invalid status" });
        return;
      }

      if (l.typeOfResidence && !ALLOWED_RESIDENCE.includes(l.typeOfResidence)) {
        invalidRows.push({ row, ...l, reason: "Invalid residence type" });
        return;
      }

      if (seenPhone.has(phone) || (email && seenEmail.has(email))) {
        duplicateFileRows.push({ row, ...l, reason: "Duplicate in file" });
        return;
      }

      seenPhone.add(phone);
      if (email) seenEmail.add(email);

      phones.push(phone);
      if (email) emails.push(email);

      validRows.push({
        name,
        phone,
        email,
        status,
        projectName: l.projectName || "",
        projectCity: l.projectCity || "",
        source: l.source || "",
        budget: l.budget || "",
        typeOfResidence: l.typeOfResidence || "Other",
        details: l.details || "",
      });
    });

    // ================= DB DUPLICATE CHECK =================
    const existing = await Lead.find({
      $or: [{ phone: { $in: phones } }, { email: { $in: emails } }],
    }).select("phone email");

    const dbPhone = new Set(existing.map((e) => e.phone));
    const dbEmail = new Set(existing.map((e) => e.email));

    const finalInsert = [];

    validRows.forEach((l) => {
      if (dbPhone.has(l.phone) || (l.email && dbEmail.has(l.email))) {
        duplicateDBRows.push({ ...l, reason: "Already exists in database" });
      } else {
        finalInsert.push(l);
      }
    });

    // ================= INSERT =================
    if (finalInsert.length > 0) {
      await Lead.insertMany(finalInsert, { ordered: false });
    }

    // ================= RESPONSE =================
    res.json({
      summary: {
        total: leads.length,
        inserted: finalInsert.length,
        invalid: invalidRows.length,
        duplicateInFile: duplicateFileRows.length,
        duplicateInDB: duplicateDBRows.length,
      },
      invalidRows,
      duplicateFileRows,
      duplicateDBRows,
    });
  } catch (err) {
    console.error("Bulk import failed:", err);
    res.status(500).json({ message: "Bulk import failed" });
  }
};

// ✅ Get Today's Follow-ups
exports.getTodaysFollowUps = async (req, res, next) => {
  try {
    const user = req.user;

    // Get start and end of today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Build query based on user role
    let matchQuery = {};

    if (user.role === "manager") {
      matchQuery.assignedManager = user._id;
    } else if (user.role === "executive") {
      matchQuery.assignedExecutive = user._id;
    }
    // Admin/superadmin ke liye koi filter nahi - sab dikhega

    // Find leads with follow-ups today
    const leads = await Lead.find({
      ...matchQuery,
      "followUps.followUpAt": {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .populate("assignedExecutive", "name")
      .populate("assignedManager", "name")
      .select("name phone followUps status projectName projectCity");

    // Format the response
    const todaysFollowUps = [];

    leads.forEach((lead) => {
      lead.followUps.forEach((followUp) => {
        // Check if this follow-up is today
        const followUpDate = new Date(followUp.followUpAt);
        if (followUpDate >= startOfDay && followUpDate <= endOfDay) {
          todaysFollowUps.push({
            _id: followUp._id,
            leadId: lead._id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            projectName: lead.projectName,
            projectCity: lead.projectCity,
            followUpAt: followUp.followUpAt,
            note: followUp.note,
            createdBy: followUp.createdBy,
            createdAt: followUp.createdAt,
          });
        }
      });
    });

    // Sort by followUpAt (most recent first)
    todaysFollowUps.sort(
      (a, b) =>
        new Date(b.followUpAt).getTime() - new Date(a.followUpAt).getTime()
    );

    console.log(`📅 Found ${todaysFollowUps.length} follow-ups for today`);
    res.json(todaysFollowUps);
  } catch (e) {
    console.error("Error in getTodaysFollowUps:", e);
    next(e);
  }
};

// ✅ Get Upcoming Follow-ups (next 7 days)
exports.getUpcomingFollowUps = async (req, res, next) => {
  try {
    const user = req.user;
    const { days = 7, includePast = false } = req.query;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    // Build query based on user role
    let matchQuery = {};

    if (user.role === "manager") {
      matchQuery.assignedManager = user._id;
    } else if (user.role === "executive") {
      matchQuery.assignedExecutive = user._id;
    }

    // Date filter - include past if requested
    let dateFilter = {};
    if (includePast === "true") {
      dateFilter = { $lte: futureDate }; // All dates up to futureDate
    } else {
      dateFilter = { $gte: now, $lte: futureDate }; // Only future dates
    }

    const leads = await Lead.find({
      ...matchQuery,
      "followUps.followUpAt": dateFilter,
    })
      .populate("assignedExecutive", "name")
      .select("name phone followUps status projectName projectCity");

    const upcomingFollowUps = [];

    leads.forEach((lead) => {
      lead.followUps.forEach((followUp) => {
        const followUpDate = new Date(followUp.followUpAt);
        if (
          includePast === "true"
            ? followUpDate <= futureDate
            : followUpDate >= now && followUpDate <= futureDate
        ) {
          upcomingFollowUps.push({
            _id: followUp._id,
            leadId: lead._id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            projectName: lead.projectName,
            projectCity: lead.projectCity,
            followUpAt: followUp.followUpAt,
            note: followUp.note,
            completed: followUp.completed || false,
            createdBy: followUp.createdBy,
          });
        }
      });
    });

    // Sort by followUpAt (earliest first for upcoming, latest first for past)
    upcomingFollowUps.sort((a, b) =>
      includePast === "true"
        ? new Date(b.followUpAt).getTime() - new Date(a.followUpAt).getTime()
        : new Date(a.followUpAt).getTime() - new Date(b.followUpAt).getTime()
    );

    res.json(upcomingFollowUps);
  } catch (e) {
    next(e);
  }
};

// ✅ Get Follow-ups by Date Range (PAST + FUTURE)
exports.getFollowUpsByDateRange = async (req, res, next) => {
  try {
    const user = req.user;
    const { startDate, endDate } = req.query;

    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    if (!startDate) {
      start.setHours(0, 0, 0, 0);
    }
    if (!endDate) {
      end.setHours(23, 59, 59, 999);
    }

    // Build query based on user role
    let matchQuery = {};
    if (user.role === "manager") {
      matchQuery.assignedManager = user._id;
    } else if (user.role === "executive") {
      matchQuery.assignedExecutive = user._id;
    }

    const leads = await Lead.find({
      ...matchQuery,
      "followUps.followUpAt": {
        $gte: start,
        $lte: end,
      },
    })
      .populate("assignedExecutive", "name")
      .populate("assignedManager", "name")
      .select("name phone followUps status projectName projectCity");

    // Format the response
    const followUps = [];

    leads.forEach((lead) => {
      lead.followUps.forEach((followUp) => {
        const followUpDate = new Date(followUp.followUpAt);
        if (followUpDate >= start && followUpDate <= end) {
          followUps.push({
            _id: followUp._id,
            leadId: lead._id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            projectName: lead.projectName,
            projectCity: lead.projectCity,
            followUpAt: followUp.followUpAt,
            note: followUp.note,
            completed: followUp.completed || false,
            createdBy: followUp.createdBy,
            createdAt: followUp.createdAt,
          });
        }
      });
    });

    // Sort by followUpAt (most recent first)
    followUps.sort(
      (a, b) =>
        new Date(b.followUpAt).getTime() - new Date(a.followUpAt).getTime()
    );

    res.json(followUps);
  } catch (e) {
    console.error("Error in getFollowUpsByDateRange:", e);
    next(e);
  }
};

// ✅ Complete Follow-up (with validation)
exports.completeFollowUp = async (req, res, next) => {
  try {
    const { leadId, followUpId } = req.params;
    const { notes } = req.body;

    // Validate that IDs are different
    if (leadId === followUpId) {
      return res.status(400).json({ 
        message: "Lead ID and Follow-up ID cannot be the same" 
      });
    }

    console.log('🔍 Completing follow-up:', { leadId, followUpId });

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Find the specific follow-up
    const followUp = lead.followUps.id(followUpId);
    if (!followUp) {
      return res.status(404).json({ 
        message: "Follow-up not found",
        debug: { leadId, followUpId }
      });
    }

    // Mark as completed
    followUp.completed = true;
    followUp.completedAt = new Date();
    followUp.completionNotes = notes || followUp.note;

    await lead.save();

    res.json({
      success: true,
      message: "Follow-up completed successfully",
      followUp,
    });
  } catch (e) {
    console.error("Error in completeFollowUp:", e);
    next(e);
  }
};

// ============== ADD THESE FUNCTIONS ==============

// ✅ Get Executives for Manager with Stats
exports.getManagerExecutives = async (req, res, next) => {
  try {
    const managerId = req.user._id;

    // Get all executives assigned to this manager
    const executives = await User.find({
      role: 'executive',
      assignedManager: managerId,
      isActive: true
    }).select('name email phone isActive');

    // Get stats for each executive
    const executivesWithStats = await Promise.all(
      executives.map(async (exec) => {
        const totalLeads = await Lead.countDocuments({ 
          assignedExecutive: exec._id 
        });
        
        const activeLeads = await Lead.countDocuments({ 
          assignedExecutive: exec._id,
          status: { $in: ['active', 'followup'] }
        });
        
        const bookedLeads = await Lead.countDocuments({ 
          assignedExecutive: exec._id,
          status: 'booked'
        });

        const todayFollowUps = await Lead.countDocuments({
          assignedExecutive: exec._id,
          'followUps.followUpAt': {
            $gte: new Date().setHours(0,0,0,0),
            $lte: new Date().setHours(23,59,59,999)
          }
        });

        return {
          _id: exec._id,
          name: exec.name,
          email: exec.email,
          phone: exec.phone,
          isActive: exec.isActive,
          leads: totalLeads,
          activeLeads,
          bookedLeads,
          todayFollowUps,
          conversionRate: totalLeads > 0 
            ? ((bookedLeads / totalLeads) * 100).toFixed(1) 
            : 0
        };
      })
    );

    res.json(executivesWithStats);
  } catch (e) {
    console.error("Error in getManagerExecutives:", e);
    next(e);
  }
};

// ✅ Get Unassigned Leads for Manager
exports.getUnassignedLeads = async (req, res, next) => {
  try {
    const user = req.user;
    
    let query = {
      assignedExecutive: null  // Executive assign nahi hua
    };
    
    // Manager - sirf apni leads
    if (user.role === 'manager') {
      query.assignedManager = user._id;
    }
    // Admin/Superadmin - saari unassigned leads
    else if (['admin', 'superadmin'].includes(user.role)) {
      // No additional filter - sab dikhao
    }
    // Executive - kuch nahi
    else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const leads = await Lead.find(query)
      .populate('assignedManager', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(leads);
  } catch (e) {
    console.error("Error in getUnassignedLeads:", e);
    next(e);
  }
};
// ✅ Get Team Performance Stats
exports.getTeamPerformance = async (req, res, next) => {
  try {
    const managerId = req.user._id;
    const { period = 'week' } = req.query;

    // Get date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch(period) {
      case 'today':
        startDate.setHours(0,0,0,0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get all executives under this manager
    const executives = await User.find({
      role: 'executive',
      assignedManager: managerId
    }).select('_id name');

    const executiveIds = executives.map(e => e._id);

    // Get leads created in period
    const leadsInPeriod = await Lead.find({
      assignedExecutive: { $in: executiveIds },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate stats
    const totalLeads = leadsInPeriod.length;
    const bookedLeads = leadsInPeriod.filter(l => l.status === 'booked').length;
    const activeLeads = leadsInPeriod.filter(l => 
      ['active', 'followup'].includes(l.status)
    ).length;

    // Executive-wise stats
    const executiveStats = executives.map(exec => {
      const execLeads = leadsInPeriod.filter(l => 
        l.assignedExecutive?.toString() === exec._id.toString()
      );
      const execBooked = execLeads.filter(l => l.status === 'booked').length;
      
      return {
        _id: exec._id,
        name: exec.name,
        leads: execLeads.length,
        booked: execBooked,
        conversionRate: execLeads.length > 0 
          ? ((execBooked / execLeads.length) * 100).toFixed(1) 
          : 0
      };
    });

    res.json({
      period,
      startDate,
      endDate,
      summary: {
        totalLeads,
        bookedLeads,
        activeLeads,
        conversionRate: totalLeads > 0 
          ? ((bookedLeads / totalLeads) * 100).toFixed(1) 
          : 0
      },
      executives: executiveStats
    });
  } catch (e) {
    console.error("Error in getTeamPerformance:", e);
    next(e);
  }
};

// ✅ Get Recent Activities for Manager's Team
exports.getRecentActivities = async (req, res, next) => {
  try {
    const managerId = req.user._id;
    const { limit = 20 } = req.query;

    // Get all executives under this manager
    const executives = await User.find({
      role: 'executive',
      assignedManager: managerId
    }).select('_id name');

    const executiveIds = executives.map(e => e._id);

    // Get recent leads with activities
    const leads = await Lead.find({
      assignedExecutive: { $in: executiveIds }
    })
    .populate('assignedExecutive', 'name')
    .populate('followUps.createdBy', 'name')
    .populate('remarks.createdBy', 'name')
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit));

    const activities = [];

    leads.forEach(lead => {
      // Lead created activity
      activities.push({
        _id: `lead-${lead._id}`,
        type: 'lead_created',
        text: `New lead created: ${lead.name}`,
        time: lead.createdAt,
        user: lead.assignedExecutive?.name || 'System',
        leadId: lead._id,
        leadName: lead.name,
        icon: 'person-add',
        color: '#4CAF50'
      });

      // Status changes
      lead.statusHistory?.forEach((history, idx) => {
        activities.push({
          _id: `status-${lead._id}-${idx}`,
          type: 'status_change',
          text: `Status changed from ${history.from} to ${history.to}`,
          time: history.date,
          user: history.changedBy?.name || lead.assignedExecutive?.name,
          leadId: lead._id,
          leadName: lead.name,
          icon: 'sync',
          color: '#667eea'
        });
      });

      // Follow-ups
      lead.followUps?.forEach((followup, idx) => {
        activities.push({
          _id: `followup-${lead._id}-${idx}`,
          type: 'followup',
          text: `Follow-up scheduled: ${followup.note}`,
          time: followup.followUpAt,
          user: followup.createdBy?.name || lead.assignedExecutive?.name,
          leadId: lead._id,
          leadName: lead.name,
          icon: 'alarm',
          color: '#FF9800'
        });
      });

      // Remarks
      lead.remarks?.forEach((remark, idx) => {
        activities.push({
          _id: `remark-${lead._id}-${idx}`,
          type: 'remark',
          text: `Remark added: ${remark.text}`,
          time: remark.createdAt,
          user: remark.createdBy?.name || lead.assignedExecutive?.name,
          leadId: lead._id,
          leadName: lead.name,
          icon: 'comment',
          color: '#9C27B0'
        });
      });
    });

    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json(activities.slice(0, parseInt(limit)));
  } catch (e) {
    console.error("Error in getRecentActivities:", e);
    next(e);
  }
};