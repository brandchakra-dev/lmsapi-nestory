const crypto = require('crypto');

class OTPUtil {
  static generateOTP(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max).toString();
  }

  static generateOTPWithExpiry(length = 6, expiryMinutes = 10) {
    return {
      otp: this.generateOTP(length),
      expiresAt: Date.now() + expiryMinutes * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  static isOTPExpired(expiresAt) {
    return Date.now() > expiresAt;
  }

  static hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  static verifyOTP(plainOTP, hashedOTP) {
    return this.hashOTP(plainOTP) === hashedOTP;
  }
}

module.exports = OTPUtil;