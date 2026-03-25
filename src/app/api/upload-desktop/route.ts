import { NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ""
});

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

        const response = await imagekit.upload({
            file: buffer,
            fileName: `${serial}-desktop.jpg`,
            folder: `/machines/${serial}/`,
            useUniqueFileName: false,
            overwriteFile: true
        });

        return NextResponse.json({
            success: true,
            url: response.url,
        });
    } catch (error) {
        console.error("upload-desktop error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}

