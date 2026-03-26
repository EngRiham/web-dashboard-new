import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

/**
 * GÜVENLİK: Firebase Auth token doğrulama middleware'i.
 * Tüm API endpoint'lerinde kullanılır.
 * Authorization: Bearer <token> header'ı gerektirir.
 */
export async function verifyAuthToken(req: NextRequest): Promise<{
    uid: string;
    email?: string;
} | null> {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.split("Bearer ")[1];
        if (!token) return null;

        const decodedToken = await adminAuth.verifyIdToken(token);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
    } catch {
        return null;
    }
}

/**
 * GÜVENLİK: Basit rate limiter (bellek tabanlı).
 * IP başına belirli bir süre içinde izin verilen istek sayısını sınırlar.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
    identifier: string,
    maxRequests: number = 5,
    windowMs: number = 60000 // 1 dakika
): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
        return true; // İzin ver
    }

    if (entry.count >= maxRequests) {
        return false; // Limit aşıldı
    }

    entry.count++;
    return true; // İzin ver
}

/**
 * GÜVENLİK: Yetkisiz erişim yanıtı.
 */
export function unauthorizedResponse() {
    return NextResponse.json(
        { error: "Yetkisiz erişim. Lütfen giriş yapın." },
        { status: 401 }
    );
}

/**
 * GÜVENLİK: Rate limit aşıldı yanıtı.
 */
export function rateLimitResponse() {
    return NextResponse.json(
        { error: "Çok fazla istek. Lütfen bir süre bekleyin." },
        { status: 429 }
    );
}
