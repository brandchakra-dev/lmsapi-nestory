const axios = require("axios");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { mapFacebookLead } = require("../utils/fbMapper");
const { sendPushNotification } = require("../services/push.service");

const VERIFY_TOKEN = "thenestory_verify_05521";

// ✅ VERIFY
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
};

// ✅ RECEIVE
exports.receiveLead = async (req, res) => {
  try {
    const entry = req.body.entry;

    for (const item of entry) {
      for (const change of item.changes) {
        if (change.field === "leadgen") {
          const leadId = change.value.leadgen_id;
          await processLead(leadId);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
};

// 🔥 PROCESS LEAD
const processLead = async (leadId) => {
  try {
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

    const url = `https://graph.facebook.com/v19.0/${leadId}`;

    const { data } = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "created_time,ad_name,adset_name,field_data"
      }
    });

    // map
    const mapped = mapFacebookLead(data);

    // duplicate check
    if (mapped.phone) {
      const exists = await Lead.findOne({
        phone: mapped.phone,
        source: "facebook"
      });
      if (exists) {
        console.log("Duplicate skipped");
        return;
      }
    }

    // assign executive (simple)
    const executive = await User.findOne({
      role: "executive",
      isActive: true
    });

    // save lead
    const lead = await Lead.create({
      name: mapped.name || "No Name",
      phone: mapped.phone || "0000000000",
      email: mapped.email,
      details: mapped.details,

      source: "facebook",

      assignedExecutive: executive?._id,

      fbLeadId: leadId,
      fbRawData: data,
      fbAdName: data.ad_name,
      fbAdsetName: data.adset_name
    });

    console.log("Lead saved:", lead._id);

    // 🔔 push
    if (executive?.pushToken) {
      await sendPushNotification(
        executive.pushToken,
        "New Facebook Lead",
        lead.name,
        { leadId: lead._id }
      );
    }

  } catch (err) {
    console.error("Lead processing error:", err?.response?.data || err.message);
  }
};