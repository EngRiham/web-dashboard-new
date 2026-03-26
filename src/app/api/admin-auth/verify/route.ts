import { db, adminAuth } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/auth-middleware";

const MAX_OTP_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
    try {
        const { email, code } = await req.json();

        if (email !== "tjmproje@gmail.com" || !code) {
            return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
        }

        const clientIP = req.headers.get("x-forwarded-for") || "unknown";
        if (!checkRateLimit(`admin-otp-verify-${clientIP}`, 10, 60000)) {
            return rateLimitResponse();
        }

        const snapshot = await db.ref(`otp/admin_login`).get();
        if (!snapshot.exists()) {
            return NextResponse.json(
                { error: "Kod bulunamadı veya süresi doldu." },
                { status: 400 }
            );
        }

        const { code: savedCode, expiresAt, attempts = 0 } = snapshot.val();

        if (Date.now() > expiresAt) {
            await db.ref(`otp/admin_login`).remove();
            return NextResponse.json(
                { error: "Kodun süresi doldu. Lütfen yeni kod isteyin." },
                { status: 400 }
            );
        }

        if (attempts >= MAX_OTP_ATTEMPTS) {
            await db.ref(`otp/admin_login`).remove();
            return NextResponse.json(
                { error: "Çok fazla hatalı deneme. Lütfen yeni kod isteyin." },
                { status: 429 }
            );
        }

        if (code.trim() !== savedCode) {
            await db.ref(`otp/admin_login/attempts`).set(attempts + 1);
            return NextResponse.json(
                { error: `Yanlış kod. ${MAX_OTP_ATTEMPTS - attempts - 1} deneme hakkınız kaldı.` },
                { status: 400 }
            );
        }

        // OTP Validated Successfully!
        await db.ref(`otp/admin_login`).remove();

        // Admin kullanıcısını Firebase Auth modülünden çek (Yoksa oluştur)
        let adminUid = "";
        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            adminUid = userRecord.uid;
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Admin daha önce Firebase'e kaydedilmemişse otomatik oluştur
                const newUser = await adminAuth.createUser({
                    email: email,
                    emailVerified: true
                });
                adminUid = newUser.uid;
            } else {
                throw error;
            }
        }

        // Firebase Custom Token oluştur
        const customToken = await adminAuth.createCustomToken(adminUid);

        return NextResponse.json({ success: true, token: customToken });

    } catch (e) {
        console.error("Admin Verify Error:", e);
        return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
    }
}
