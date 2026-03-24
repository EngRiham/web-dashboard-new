import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import {
    verifyAuthToken,
    checkRateLimit,
    unauthorizedResponse,
    rateLimitResponse,
} from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
    try {
        // GÜVENLİK: Auth token doğrulaması
        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return unauthorizedResponse();
        }

        const { uid, serial, password } = await req.json();

        if (!uid || !serial || !password) {
            return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
        }

        // GÜVENLİK: UID doğrulaması — kullanıcı sadece kendi hesabına makine ekleyebilir
        // ANCAK: Admin (tjmproje@gmail.com) diğer kullanıcılara makine ekleyebilir.
        const ADMIN_EMAIL = "tjmproje@gmail.com";
        const isAdmin = authUser.email?.toLowerCase() === ADMIN_EMAIL;

        if (!isAdmin && authUser.uid !== uid) {
            return NextResponse.json(
                { error: "Yetkisiz işlem." },
                { status: 403 }
            );
        }

        // GÜVENLİK: Rate limiting — IP başına dakikada max 5 makine ekleme denemesi
        const clientIP = req.headers.get("x-forwarded-for") || "unknown";
        if (!checkRateLimit(`add-machine-${clientIP}`, 5, 60000)) {
            return rateLimitResponse();
        }

        // Makineyi global DB'de bul
        const machineSnap = await db.ref(`machines/${serial}`).get();
        if (!machineSnap.exists()) {
            return NextResponse.json(
                { error: "Bu seri numarasına sahip bir makine bulunamadı." },
                { status: 404 }
            );
        }

        const machineData = machineSnap.val();
        if (machineData.password !== password) {
            return NextResponse.json({ error: "Makine şifresi hatalı." }, { status: 403 });
        }

        // Makineyı kullanıcıya bağla
        await db.ref(`users/${uid}/machines`).update({ [serial]: true });

        return NextResponse.json({ success: true });
    } catch {
        // GÜVENLİK: Detaylı hata mesajı dönme
        return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
    }
}
