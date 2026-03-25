import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const serial = formData.get("serial") as string | null;

        if (!file || !serial) {
            return NextResponse.json(
                { success: false, message: "file or serial missing" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = path.join(process.cwd(), "public", "live");
        const filePath = path.join(uploadDir, `${serial}-camera.jpg`);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({
            success: true,
            imageUrl: `/live/${serial}-camera.jpg`,
        });
    } catch (error) {
        console.error("upload-camera error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}