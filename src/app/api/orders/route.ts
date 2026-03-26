import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const text = typeof body?.text === "string" ? body.text : "";

        const filePath = path.join(process.cwd(), "public", "order.txt");
        fs.writeFileSync(filePath, text, "utf8");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API write error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
