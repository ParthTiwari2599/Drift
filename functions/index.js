const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

// Runs every 2 hours and deletes expired group messages
exports.cleanupExpiredMessages = functions.pubsub
  .schedule("every 2 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const batchLimit = 500;

    while (true) {
      const snapshot = await db
        .collection("messages")
        .where("expireAt", "<=", now)
        .limit(batchLimit)
        .get();

      if (snapshot.empty) break;

      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return null;
  });
