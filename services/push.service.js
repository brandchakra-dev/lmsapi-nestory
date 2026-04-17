const { Expo } = require('expo-server-sdk');

const expo = new Expo();

exports.sendPushNotification = async (pushToken, title, body, data = {}) => {
  try {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log('Invalid push token');
      return;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    await expo.sendPushNotificationsAsync([message]);

    console.log("✅ Push sent");
    
  } catch (error) {
    console.error('Push notification error:', error);
  }
};