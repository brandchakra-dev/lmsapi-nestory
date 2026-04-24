const express = require("express");
const router = express.Router();
const webhookCtrl = require("../controllers/webhookController");

// VERIFY
router.get("/facebook", webhookCtrl.verifyWebhook);

// RECEIVE
router.post("/facebook", webhookCtrl.receiveLead);

module.exports = router;