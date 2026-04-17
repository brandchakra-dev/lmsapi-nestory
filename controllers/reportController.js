
const Lead = require("../models/Lead");
const User = require("../models/User");
const Activity = require("../models/Activity");

exports.superAdminSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);

    // Basic counts
    const [
      totalLeads,
      closed,
      active,
      inactive,
      hot,
      warm,
      followup,
      booked,
      todayLeads,
      weekLeads,
      managers,
      executives
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: "closed" }),
      Lead.countDocuments({ status: "active" }),
      Lead.countDocuments({ status: "inactive" }),
      Lead.countDocuments({ status: "hot" }),
      Lead.countDocuments({ status: "warm" }),
      Lead.countDocuments({ status: "followup" }),
      Lead.countDocuments({ status: "booked" }),
      Lead.countDocuments({ createdAt: { $gte: today } }),
      Lead.countDocuments({ createdAt: { $gte: lastWeek } }),
      User.countDocuments({ role: "manager", status: "active" }),
      User.countDocuments({ role: "executive", status: "active" })
    ]);

    // Today's follow-ups
    const todayFollowups = await Lead.countDocuments({
      "followUps.followUpAt": {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Budget calculations
    const budgetStats = await Lead.aggregate([
      {
        $group: {
          _id: null,
          avgBudget: { $avg: "$budget" },
          maxBudget: { $max: "$budget" },
          totalBookedValue: {
            $sum: {
              $cond: [{ $eq: ["$status", "booked"] }, "$budget", 0]
            }
          }
        }
      }
    ]);

    // Conversion rate
    const conversionRate = totalLeads > 0 ? ((closed / totalLeads) * 100).toFixed(1) : 0;

    // Team performance (based on assigned leads)
    const teamPerformance = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$assignedExecutive",
          totalAssigned: { $sum: 1 },
          converted: {
            $sum: {
              $cond: [{ $in: ["$status", ["closed", "booked"]] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          successRate: {
            $multiply: [
              { $divide: ["$converted", "$totalAssigned"] },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgSuccessRate: { $avg: "$successRate" }
        }
      }
    ]);

    const recentActivities = await Lead.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate("assignedExecutive", "name email")
      .populate("assignedManager", "name")
      .select("name status createdAt updatedAt assignedExecutive assignedManager")
      .lean();

    res.json({
      totalLeads,
      closed: parseInt(closed),
      active: parseInt(active),
      inactive: parseInt(inactive),
      hot: parseInt(hot),
      warm: parseInt(warm),
      followup: parseInt(followup),
      booked: parseInt(booked),
      todayLeads: parseInt(todayLeads),
      weekLeads: parseInt(weekLeads),
      todayFollowups: parseInt(todayFollowups),
      managers: parseInt(managers),
      executives: parseInt(executives),
      avgBudget: budgetStats[0]?.avgBudget || 0,
      maxBudget: budgetStats[0]?.maxBudget || 0,
      totalBookedValue: budgetStats[0]?.totalBookedValue || 0,
      conversionRate: parseFloat(conversionRate),
      teamPerformance: teamPerformance[0]?.avgSuccessRate?.toFixed(1) || 0,
      recentActivities
    });
  } catch (e) {
    next(e);
  }
};

exports.chartData = async (req, res, next) => {
  try {
    const { timeRange = 'week' } = req.query;
    const today = new Date();
    
    let dateFilter = {};
    let groupFormat = {};
    let limit = 0;

    switch(timeRange) {
      case 'day':
        // Last 7 days
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = { createdAt: { $gte: weekAgo } };
        groupFormat = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        };
        limit = 7;
        break;
      case 'week':
        // Last 4 weeks
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        dateFilter = { createdAt: { $gte: monthAgo } };
        groupFormat = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" }
        };
        limit = 4;
        break;
      case 'month':
        // Last 6 months
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        dateFilter = { createdAt: { $gte: sixMonthsAgo } };
        groupFormat = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        };
        limit = 6;
        break;
    }

    // Monthly data for stacked bar chart
    const monthlyData = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 6, 1) }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          data: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Prepare monthly data for chart
    const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const monthlyStatusData = {
      new: Array(7).fill(0),
      hot: Array(7).fill(0),
      warm: Array(7).fill(0),
      followup: Array(7).fill(0),
      booked: Array(7).fill(0),
      closed: Array(7).fill(0)
    };

    monthlyData.forEach(month => {
      const monthIndex = month._id - 1;
      month.data.forEach(item => {
        if (monthlyStatusData[item.status]) {
          monthlyStatusData[item.status][monthIndex] = item.count;
        }
      });
    });

    // Daily performance data
    const dailyData = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          avgBudget: { $avg: "$budget" },
          converted: {
            $sum: {
              $cond: [{ $in: ["$status", ["closed", "booked"]] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          avgBudget: { $round: ["$avgBudget", 2] },
          conversionRate: {
            $cond: [
              { $eq: ["$count", 0] },
              0,
              { $multiply: [{ $divide: ["$converted", "$count"] }, 100] }
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // User performance data
    const userPerformance = await User.aggregate([
      {
        $match: {
          role: { $in: ["executive", "manager"] },
          status: "active"
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "_id",
          foreignField: "assignedExecutive",
          as: "assignedLeads"
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          totalLeads: { $size: "$assignedLeads" },
          convertedLeads: {
            $size: {
              $filter: {
                input: "$assignedLeads",
                as: "lead",
                cond: { $in: ["$$lead.status", ["closed", "booked"]] }
              }
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          totalLeads: 1,
          convertedLeads: 1,
          successRate: {
            $cond: [
              { $eq: ["$totalLeads", 0] },
              0,
              { $multiply: [{ $divide: ["$convertedLeads", "$totalLeads"] }, 100] }
            ]
          }
        }
      },
      { $sort: { successRate: -1 } },
      { $limit: 5 }
    ]);

    // Lead source distribution
    const leadSources = await Lead.aggregate([
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 7 }
    ]);

    // Recent activities for dashboard
    const recentActivities = await Lead.find()
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate("assignedExecutive", "name")
      .populate("assignedManager", "name")
      .select("name status createdAt updatedAt assignedExecutive assignedManager")
      .lean();

    res.json({
      monthlyLabels,
      monthlyNew: monthlyStatusData.new,
      monthlyHot: monthlyStatusData.hot,
      monthlyWarm: monthlyStatusData.warm,
      monthlyFollowup: monthlyStatusData.followup,
      monthlyBooked: monthlyStatusData.booked,
      monthlyClosed: monthlyStatusData.closed,
      dailyLabels: dailyData.map(d => new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })),
      dailyLeads: dailyData.map(d => d.count),
      dailyBudget: dailyData.map(d => (d.avgBudget / 100000).toFixed(1)),
      dailyConversion: dailyData.map(d => d.conversionRate?.toFixed(1) || 0),
      topUsers: userPerformance,
      leadSources,
      recentActivities
    });
  } catch (e) {
    next(e);
  }
};

/* ================= MANAGER SUMMARY ================= */

exports.managerSummary = async (req, res, next) => {
  try {
    const managerId = req.user._id;

    const leads = await Lead.find({ assignedManager: managerId });

    const totalExecutives = await User.countDocuments({
      role: "executive",
      assignedManager: managerId,
    });

    const activeExecutives = await User.countDocuments({
      role: "executive",
      assignedManager: managerId,
      isActive: true,
    });

    const totalLeads = leads.length;

    const inactiveLeads = await Lead.countDocuments({
      assignedManager: managerId,
      status: "inactive",
    });

    const closedLeads = await Lead.countDocuments({
      assignedManager: managerId,
      status: "closed",
    });

    const pendingFollowups = await Lead.countDocuments({
      assignedManager: managerId,
      "followUps.followUpAt": { $gte: new Date() },
    });

    const weeklyMap = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    leads.forEach((lead) => {
      const day = days[new Date(lead.createdAt).getDay()];
      weeklyMap[day] = (weeklyMap[day] || 0) + 1;
    });

    const weeklyLeads = days.map((d) => ({
      day: d,
      count: weeklyMap[d] || 0,
    }));

    res.json({
      totalExecutives,
      activeExecutives,
      totalLeads,
      inactiveLeads,
      closedLeads,
      pendingFollowups,
      weeklyLeads,
    });
  } catch (e) {
    next(e);
  }
};

/* ================= MANAGER CHART DATA ================= */

exports.managerChartData = async (req, res, next) => {
  try {
    const { timeRange = 'week' } = req.query;
    const managerId = req.user._id;
    const today = new Date();

    // Get manager's assigned leads
    const managerLeads = await Lead.find({ assignedManager: managerId });

    // Monthly data for stacked bar chart
    const monthlyData = await Lead.aggregate([
      {
        $match: {
          assignedManager: managerId,
          createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 6, 1) }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          data: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Prepare monthly data
    const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const monthlyStatusData = {
      active: Array(7).fill(0),
      hot: Array(7).fill(0),
      followup: Array(7).fill(0),
      booked: Array(7).fill(0),
      closed: Array(7).fill(0)
    };

    monthlyData.forEach(month => {
      const monthIndex = month._id - 1;
      month.data.forEach(item => {
        if (monthlyStatusData[item.status]) {
          monthlyStatusData[item.status][monthIndex] = item.count;
        }
      });
    });

    // Daily performance data
    const dailyData = await Lead.aggregate([
      {
        $match: {
          assignedManager: managerId,
          createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          avgBudget: { $avg: "$budget" },
          converted: {
            $sum: {
              $cond: [{ $in: ["$status", ["closed", "booked"]] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          avgBudget: { $round: ["$avgBudget", 2] },
          conversionRate: {
            $cond: [
              { $eq: ["$count", 0] },
              0,
              { $multiply: [{ $divide: ["$converted", "$count"] }, 100] }
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Top executives performance
    const topExecutives = await User.aggregate([
      {
        $match: {
          role: "executive",
          assignedManager: managerId,
          status: "active"
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "_id",
          foreignField: "assignedExecutive",
          as: "assignedLeads"
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          totalLeads: { $size: "$assignedLeads" },
          convertedLeads: {
            $size: {
              $filter: {
                input: "$assignedLeads",
                as: "lead",
                cond: { $in: ["$$lead.status", ["closed", "booked"]] }
              }
            }
          }
        }
      },
      {
        $match: {
          totalLeads: { $gt: 0 }
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          totalLeads: 1,
          convertedLeads: 1,
          successRate: {
            $cond: [
              { $eq: ["$totalLeads", 0] },
              0,
              { $multiply: [{ $divide: ["$convertedLeads", "$totalLeads"] }, 100] }
            ]
          }
        }
      },
      { $sort: { successRate: -1, totalLeads: -1 } },
      { $limit: 5 }
    ]);

    // Lead source distribution for manager's leads
    const leadSources = await Lead.aggregate([
      {
        $match: {
          assignedManager: managerId,
          source: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent activities
    const recentActivities = await Lead.find({ assignedManager: managerId })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate("assignedExecutive", "name")
      .select("name phone status createdAt updatedAt assignedExecutive")
      .lean();

    res.json({
      monthlyLabels,
      monthlyActive: monthlyStatusData.active,
      monthlyHot: monthlyStatusData.hot,
      monthlyFollowup: monthlyStatusData.followup,
      monthlyBooked: monthlyStatusData.booked,
      monthlyClosed: monthlyStatusData.closed,
      dailyLabels: dailyData.map(d => new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })),
      dailyLeads: dailyData.map(d => d.count || 0),
      dailyBudget: dailyData.map(d => ((d.avgBudget || 0) / 100000).toFixed(1)),
      dailyConversion: dailyData.map(d => (d.conversionRate || 0).toFixed(1)),
      topExecutives,
      leadSources,
      recentActivities
    });
  } catch (e) {
    console.error('Error in managerChartData:', e);
    next(e);
  }
};

/* ================= EXECUTIVE SUMMARY ================= */

exports.executiveSummary = async (req, res, next) => {
  try {
    const executiveId = req.user._id;

    const leads = await Lead.find({
      assignedExecutive: executiveId,
    }).select("status followUps createdAt");

    const totalLeads = leads.length;

    const inactiveLeads = leads.filter((l) => l.status === "inactive").length;
    const activeLeads = leads.filter((l) => l.status === "active").length;
    const closedLeads = leads.filter((l) => l.status === "closed").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayFollowups = 0;
    let pendingFollowups = 0;

    leads.forEach((lead) => {
      lead.followUps?.forEach((f) => {
        const followDate = new Date(f.followUpAt);
        followDate.setHours(0, 0, 0, 0);

        if (followDate.getTime() === today.getTime()) {
          todayFollowups++;
        } else if (followDate < today) {
          pendingFollowups++;
        }
      });
    });

    const weeklyMap = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    leads.forEach((lead) => {
      const day = days[new Date(lead.createdAt).getDay()];
      weeklyMap[day] = (weeklyMap[day] || 0) + 1;
    });

    const weeklyLeads = days.map((d) => ({
      day: d,
      count: weeklyMap[d] || 0,
    }));

    res.json({
      totalLeads,
      inactiveLeads,
      activeLeads,
      closedLeads,
      todayFollowups,
      pendingFollowups,
      weeklyLeads,
    });
  } catch (error) {
    next(error);
  }
};

/* ================= EXECUTIVE CHART DATA ================= */

exports.executiveChartData = async (req, res, next) => {
  try {
    const { timeRange = 'week' } = req.query;
    const executiveId = req.user._id;
    const today = new Date();



    // Get executive's assigned leads
    const executiveLeads = await Lead.find({ assignedExecutive: executiveId });

    // Monthly data for stacked bar chart
    const monthlyData = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: executiveId,
          createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 6, 1) }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          data: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Prepare monthly data
    const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const monthlyStatusData = {
      active: Array(7).fill(0),
      hot: Array(7).fill(0),
      followup: Array(7).fill(0),
      booked: Array(7).fill(0),
      closed: Array(7).fill(0)
    };

    monthlyData.forEach(month => {
      const monthIndex = month._id - 1;
      month.data.forEach(item => {
        if (monthlyStatusData[item.status]) {
          monthlyStatusData[item.status][monthIndex] = item.count;
        }
      });
    });

    // Daily performance data
    const dailyData = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: executiveId,
          createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          avgBudget: { $avg: "$budget" },
          converted: {
            $sum: {
              $cond: [{ $in: ["$status", ["closed", "booked"]] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          avgBudget: { $round: ["$avgBudget", 2] },
          conversionRate: {
            $cond: [
              { $eq: ["$count", 0] },
              0,
              { $multiply: [{ $divide: ["$converted", "$count"] }, 100] }
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Lead source distribution
    const leadSources = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: executiveId,
          source: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Upcoming follow-ups
    const upcomingFollowups = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: executiveId,
          "followUps.followUpAt": { $gte: today }
        }
      },
      {
        $unwind: "$followUps"
      },
      {
        $match: {
          "followUps.followUpAt": { $gte: today }
        }
      },
      {
        $sort: { "followUps.followUpAt": 1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          name: 1,
          phone: 1,
          status: 1,
          leadId: "$_id",
          time: "$followUps.followUpAt"
        }
      }
    ]);

    const pendingFollowups = await Lead.countDocuments({
      assignedManager: executiveId,
      "followUps.followUpAt": { $gte: new Date() },
    });

    // Recent leads
    const recentLeads = await Lead.find({ assignedExecutive: executiveId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name phone email status createdAt")
      .lean();

    // Calculate total booked value
    const bookedValue = await Lead.aggregate([
      {
        $match: {
          assignedExecutive: executiveId,
          status: "booked"
        }
      },
      {
        $group: {
          _id: null,
          totalBookedValue: { $sum: "$budget" }
        }
      }
    ]);

    res.json({
      monthlyLabels,
      monthlyActive: monthlyStatusData.active,
      monthlyHot: monthlyStatusData.hot,
      monthlyFollowup: monthlyStatusData.followup,
      monthlyBooked: monthlyStatusData.booked,
      monthlyClosed: monthlyStatusData.closed,
      dailyLabels: dailyData.map(d => new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })),
      dailyLeads: dailyData.map(d => d.count || 0),
      dailyBudget: dailyData.map(d => ((d.avgBudget || 0) / 100000).toFixed(1)),
      dailyConversion: dailyData.map(d => (d.conversionRate || 0).toFixed(1)),
      leadSources,
      upcomingFollowups,
      pendingFollowups,
      recentLeads,
      totalBookedValue: bookedValue[0]?.totalBookedValue || 0
    });
  } catch (e) {
    console.error('Error in executiveChartData:', e);
    next(e);
  }
};

/* ================= ACTIVITY ================= */

exports.getAllActivity = async (req, res) => {
  const logs = await Activity.find()
    .populate("user", "name role")
    .sort({ date: -1 })
    .limit(200);

  res.json(logs);
};