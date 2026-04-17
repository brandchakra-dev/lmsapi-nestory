const Lead = require("../models/Lead");

exports.getMyFollowups = async (req, res, next) => {
  try {
    const user = req.user;

    let match = {};

    if (user.role === "executive") {
      match.assignedExecutive = user._id;
    }

    if (user.role === "manager") {
      match.assignedManager = user._id;
    }

    const leads = await Lead.find(match)
      .select("name phone followUps projectName")
      .populate("followUps.createdBy", "name");

    const followups = [];

    leads.forEach(lead => {
      lead.followUps.forEach(f => {
        followups.push({
          leadId: lead._id,
          leadName: lead.name,
          phone: lead.phone,
          project: lead.projectName,
          followUpAt: f.followUpAt,
          note: f.note,
          by: f.createdBy?.name
        });
      });
    });

    followups.sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));

    res.json(followups);
  } catch (e) {
    next(e);
  }
};
