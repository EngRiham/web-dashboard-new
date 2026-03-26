import * as admin from "firebase-admin";

// Tek seferlik başlatma (Hata kontrolü eklenmiş hali)
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, "\n"),
            }),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        });
        console.log("Firebase Admin SDK baslatildi.");
    } else {
        console.warn("Firebase Admin SDK credentials eksik. Bazı özellikler çalışmayabilir.");
    }
}

export const db = admin.database();
export const adminAuth = admin.auth();
