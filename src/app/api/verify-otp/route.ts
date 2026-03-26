import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/auth-middleware";

// GÜVENLİK: Brute force koruması — UID başına max deneme sayısı
const MAX_OTP_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
    try {
        const { uid, code } = await req.json();

        if (!uid || !code) {
            return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
        }

        // GÜVENLİK: Rate limiting — IP başına dakikada max 10 doğrulama denemesi
        const clientIP = req.headers.get("x-forwarded-for") || "unknown";
        if (!checkRateLimit(`otp-verify-${clientIP}`, 10, 60000)) {
            return rateLimitResponse();
        }

        const snapshot = await db.ref(`otp/${uid}`).get();
        if (!snapshot.exists()) {
            return NextResponse.json(
                { error: "Kod bulunamadı veya süresi doldu." },
                { status: 400 }
            );
        }

        const { code: savedCode, expiresAt, attempts = 0 } = snapshot.val();

        // GÜVENLİK: Süre kontrolü
        if (Date.now() > expiresAt) {
            await db.ref(`otp/${uid}`).remove();
            return NextResponse.json(
                { error: "Kodun süresi doldu. Lütfen yeni kod isteyin." },
                { status: 400 }
            );
        }

        // GÜVENLİK: Brute force koruması — max deneme sayısı aşıldıysa OTP'yi sil
        if (attempts >= MAX_OTP_ATTEMPTS) {
            await db.ref(`otp/${uid}`).remove();
            return NextResponse.json(
                { error: "Çok fazla hatalı deneme. Lütfen yeni kod isteyin." },
                { status: 429 }
            );
        }

        // Kod kontrolü
        if (code.trim() !== savedCode) {
            // GÜVENLİK: Hatalı deneme sayacını artır
            await db.ref(`otp/${uid}/attempts`).set(attempts + 1);
            return NextResponse.json(
                { error: `Yanlış kod. ${MAX_OTP_ATTEMPTS - attempts - 1} deneme hakkınız kaldı.` },
                { status: 400 }
            );
        }

        // Doğrulama başarılı — OTP'yi sil
        await db.ref(`otp/${uid}`).remove();
        return NextResponse.json({ success: true });
    } catch {
        // GÜVENLİK: Detaylı hata mesajı dönme
        return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
    }
}
