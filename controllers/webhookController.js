const crypto = require("crypto");
const axios  = require("axios");

const Lead   = require("../models/Lead");
const User   = require("../models/User");

const { mapFacebookLead }      = require("../utils/fbMapper");
const { sendPushNotification } = require("../services/push.service");
const { sendLeadEmailToAdmin } = require("../services/mail.service");

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "thenestory_verify_05521";

// ─── HMAC validation ──────────────────────────────────────────────────────────
const isValidSignature = (req) => {
  const sig = req.headers["x-hub-signature-256"];
  if (!sig || !req.rawBody) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.FB_APP_SECRET)
      .update(req.rawBody)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
};

// ─── VERIFY ───────────────────────────────────────────────────────────────────
exports.verifyWebhook = (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

// ─── RECEIVE ──────────────────────────────────────────────────────────────────
exports.receiveLead = async (req, res) => {
  res.sendStatus(200); // hamesha pehle

  if (!isValidSignature(req)) {
    console.warn("Invalid signature — dropped");
    return;
  }

  const body = req.body;
  if (!body || body.object !== "page") return;

  for (const item of body.entry || []) {
    for (const change of item.changes || []) {
      if (change.field === "leadgen") {
        const leadId = change.value?.leadgen_id;
        if (leadId) await processLead(leadId);
      }
    }
  }
};

// ─── PROCESS LEAD ─────────────────────────────────────────────────────────────
const processLead = async (leadId) => {
  try {
    // 1. FB se data fetch karo
    const { data } = await axios.get(
      `https://graph.facebook.com/v19.0/${leadId}`,
      {
        params: {
          access_token: process.env.FB_ACCESS_TOKEN,
          fields: "created_time,ad_name,adset_name,field_data",
        },
      }
    );

    const mapped = mapFacebookLead(data);

    // 2. Duplicate check
    if (mapped.phone) {
      const exists = await Lead.findOne({ phone: mapped.phone, source: "facebook" });
      if (exists) {
        console.log("Duplicate skipped:", mapped.phone);
        return;
      }
    }

    // 3. FB leads ka designated manager dhundo
    const manager = await User.findOne({
      role:            "manager",
      isActive:        true,
      isFbLeadManager: true,
    });

    // 4. Us manager ke under ka executive — round robin
    const executive = await User.findOne({
      role:     "executive",
      isActive: true,
      ...(manager ? { assignedManager: manager._id } : {}),
    }).sort({ lastLeadAssignedAt: 1 });

    // 5. Lead save karo
    const lead = await Lead.create({
      name:    mapped.name  || "No Name",
      phone:   mapped.phone || "0000000000",
      email:   mapped.email,
      details: mapped.details,
      source:  "facebook",

      assignedManager:   manager?._id  || null,
      assignedExecutive: executive?._id || null,
      assignedDate:      new Date(),

      fbLeadId:    leadId,
      fbRawData:   data,
      fbAdName:    data.ad_name,
      fbAdsetName: data.adset_name,
    });

    console.log(`Lead saved: ${lead._id} | Manager: ${manager?.name || "None"}`);

    // 6. Executive lastLeadAssignedAt update — round robin ke liye
    if (executive) {
      await User.findByIdAndUpdate(executive._id, {
        lastLeadAssignedAt: new Date(),
      });
    }

    // 7. Teen kaam parallel — ek fail ho to baaki na rukein
    const results = await Promise.allSettled([

      // 7a. Manager ko push notification
      (async () => {
        if (!manager?.pushToken) {
          console.log("Manager push skipped — no pushToken");
          return;
        }
        await sendPushNotification(
          manager.pushToken,
          "New Facebook Lead",
          `${lead.name}  •  ${lead.phone}`,
          { leadId: lead._id.toString(), screen: "LeadDetail" }
        );
        console.log("Manager push sent →", manager.name);
      })(),

      // 7b. Admin ko email — manager name bhi bhejo
      sendLeadEmailToAdmin({
        ...lead.toObject(),
        assignedManagerName: manager?.name || "Unassigned",
      }),

    ]);

    // Log jo fail hua
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Task ${i} failed:`, r.reason?.message);
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      console.log("Duplicate fbLeadId skipped:", leadId);
      return;
    }
    console.error("processLead error:", err?.response?.data || err.message);
  }
};