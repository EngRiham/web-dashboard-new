import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
    verifyAuthToken,
    checkRateLimit,
    unauthorizedResponse,
    rateLimitResponse,
} from "@/lib/auth-middleware";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
    try {
        const { email, uid } = await req.json();

        if (!email || !uid) {
            return NextResponse.json({ error: "E-posta ve UID gerekli." }, { status: 400 });
        }

        // GÜVENLİK: Rate limiting — IP başına dakikada max 3 OTP gönderebilir
        const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        if (!checkRateLimit(`otp-send-${clientIP}`, 3, 60000)) {
            return rateLimitResponse();
        }

        // GÜVENLİK: E-posta başına da rate limit — 5 dakikada max 2 OTP
        if (!checkRateLimit(`otp-email-${email}`, 2, 300000)) {
            return rateLimitResponse();
        }

        // OTP oluştur
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        // Firebase'e yaz
        try {
            await Promise.race([
                db.ref(`otp/${uid}`).set({ code: otp, expiresAt, attempts: 0 }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Veritabanı zaman aşımı")), 8000)
                ),
            ]);
        } catch {
            return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
        }

        // Resend ile Mail gönder
        try {
            const { error } = await resend.emails.send({
                from: "TJM CNC Monitor <no-reply@tjmcnc.com>",
                to: email,
                subject: "Giriş Doğrulama Kodunuz",
                html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111;color:#fff;border-radius:16px">
            <h2 style="color:#ef4444;margin-bottom:8px">TJM CNC Monitor</h2>
            <p style="color:#9ca3af;margin-bottom:24px">Giriş doğrulama kodunuz:</p>
            <div style="background:#1f1f1f;border:1px solid #333;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:900;letter-spacing:12px;color:#fff">
              ${otp}
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">Bu kod 10 dakika geçerlidir.</p>
          </div>
        `,
            });

            if (error) throw new Error(error.message);
        } catch {
            return NextResponse.json({ error: "Mail gönderilemedi." }, { status: 500 });
        }

        return NextResponse.json({ success: true, uid });
    } catch {
        // GÜVENLİK: Detaylı hata mesajı DÖNME — bilgi sızdırabilir
        return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
    }
}
