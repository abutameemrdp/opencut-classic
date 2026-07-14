import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// In the future, you will get the user ID from your authentication system (e.g. Supabase Auth)
const getUserId = () => "user_default";

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 }
			);
		}

		// Ensure it's an image
		if (!file.type.startsWith("image/")) {
			return NextResponse.json(
				{ error: "Only images are allowed" },
				{ status: 400 }
			);
		}

		const userId = getUserId();
		
		// In the future, you will upload this buffer to Backblaze B2 using their SDK
		const buffer = Buffer.from(await file.arrayBuffer());
		
		// Local simulated upload
		const publicDir = path.join(process.cwd(), "public");
		const uploadDir = path.join(publicDir, "uploads", "stickers", userId);
		
		await fs.mkdir(uploadDir, { recursive: true });
		
		// Create a unique filename
		const ext = path.extname(file.name) || ".png";
		const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
		const filePath = path.join(uploadDir, filename);
		
		await fs.writeFile(filePath, buffer);

		// The public URL that will be used in the application
		// In the future, this will be your Cloudflare CDN URL pointing to Backblaze
		const publicUrl = `/uploads/stickers/${userId}/${filename}`;

		// In the future, you will insert this record into your Supabase database here
		// await supabase.from('user_stickers').insert({ user_id: userId, path: publicUrl, ... })

		return NextResponse.json({ url: publicUrl, success: true });
	} catch (error) {
		console.error("Error uploading sticker:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
