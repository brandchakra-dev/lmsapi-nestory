let ExpoClass;
let expo;

const getExpo = async () => {
  if (!ExpoClass) {
    const module = await import('expo-server-sdk');
    ExpoClass = module.Expo;
    expo = new ExpoClass();
  }
  return { ExpoClass, expo };
};

exports.sendPushNotification = async (pushToken, title, body, data = {}) => {
  try {
    const { ExpoClass, expo } = await getExpo();

    if (!pushToken || !ExpoClass.isExpoPushToken(pushToken)) {
      console.log('Invalid push token');
      return;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',  
      channelId: 'default',  
    };

    expo.sendPushNotificationsAsync([message])
  .then(() => console.log("✅ Push sent"))
  .catch(err => console.error("Push error:", err));

    console.log("✅ Push sent");

  } catch (error) {
    console.error('Push notification error:', error);
  }
};