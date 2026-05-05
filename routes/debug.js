const express = require('express');
const router = express.Router();

const emailService = require('../services/email.service');

router.post("/debug-email", async (req, res) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email required"
        });
      }
  
      const result = await emailService.sendOTPEmail(
        email,
        "123456",
        "Debug User"
      );
  
      return res.json({
        success: true,
        message: "Email sent",
        messageId: result.messageId
      });
  
    } catch (error) {
      console.error("❌ DEBUG EMAIL ERROR:", error);
  
      return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code,
        response: error.response
      });
    }
  });

  module.exports = router;