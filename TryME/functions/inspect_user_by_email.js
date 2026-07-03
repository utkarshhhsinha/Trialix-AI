const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "aura-ai-powered-fashion-aura"
  });
}
const db = admin.firestore();

async function inspectUser() {
  const email = "muskangupta250604@gmail.com";
  console.log("Searching Auth for email:", email);
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log("Auth User Record found:", {
      uid: userRecord.uid,
      displayName: userRecord.displayName,
      email: userRecord.email,
      photoURL: userRecord.photoURL,
    });
    
    // Check Firestore profiles collection
    const profileDoc = await db.collection('profiles').doc(userRecord.uid).get();
    if (profileDoc.exists) {
      console.log("Firestore Profile exists:", profileDoc.data());
    } else {
      console.log("Firestore Profile DOES NOT EXIST for uid:", userRecord.uid);
    }
    
    // Check daily_picks document
    const pickDoc = await db.collection('daily_picks').doc(userRecord.uid).get();
    if (pickDoc.exists) {
      console.log("Firestore Daily Picks exists:", pickDoc.data());
    } else {
      console.log("Firestore Daily Picks DOES NOT EXIST for uid:", userRecord.uid);
    }
  } catch (err) {
    console.error("Error inspecting user:", err.message);
  }
}

inspectUser().catch(console.error);
