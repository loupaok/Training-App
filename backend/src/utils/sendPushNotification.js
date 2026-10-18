import admin from 'firebase-admin';

let initializationAttempted = false;

function initializeFirebase() {
  if (initializationAttempted) return admin.apps.length > 0;
  initializationAttempted = true;

  if (!process.env.FCM_SERVER_KEY) return false;

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : null;

    if (!serviceAccount) {
      console.error('FCM is configured but FIREBASE_SERVICE_ACCOUNT_JSON is missing. Push notification skipped.');
      return false;
    }

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return true;
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error.message);
    return false;
  }
}

export async function sendPushNotification(pushToken, title, body) {
  if (!pushToken || !process.env.FCM_SERVER_KEY || !initializeFirebase()) return false;

  try {
    await admin.messaging().send({
      token: pushToken,
      notification: { title: String(title || ''), body: String(body || '') },
    });
    return true;
  } catch (error) {
    console.error('FCM push notification failed:', error.message);
    return false;
  }
}
