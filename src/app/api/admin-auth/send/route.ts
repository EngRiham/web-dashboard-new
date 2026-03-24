import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { checkRateLimit, rateLimitResponse } from "@/lib/auth-middleware";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        // Admin e-postasını sıkı denetimle kontrol et
        if (email !== "tjmproje@gmail.com") {
            return NextResponse.json({ error: "Sadece yetkili admin hesabı giriş yapabilir." }, { status: 403 });
        }

        // Rate limiting (IP başına dakikada 3 istek)
        const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        if (!checkRateLimit(`admin-otp-send-${clientIP}`, 3, 60000)) {
            return rateLimitResponse();
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 dakika

        try {
            await Promise.race([
                db.ref(`otp/admin_login`).set({ code: otp, expiresAt, attempts: 0 }),
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
                from: "TJM CNC Admin <no-reply@tjmcnc.com>",
                to: email,
                subject: "Yönetici Giriş Kodunuz",
                html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111;color:#fff;border-radius:16px">
            <h2 style="color:#ef4444;margin-bottom:8px">TJM CNC Admin Paneli</h2>
            <p style="color:#9ca3af;margin-bottom:24px">Yönetici girişi için doğrulama kodunuz:</p>
            <div style="background:#1f1f1f;border:1px solid #333;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:900;letter-spacing:12px;color:#fff">
              ${otp}
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">Bu kod 10 dakika geçerlidir. Kodu kimseyle paylaşmayın.</p>
          </div>
        `,
            });

            if (error) throw new Error(error.message);
        } catch {
            return NextResponse.json({ error: "Mail gönderilemedi." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
    }
}
