import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const getUserId = () => "user_default";

export async function GET() {
	try {
		const userId = getUserId();
		
		// In the future, you will fetch the list of sticker paths from your Supabase database
		// const { data } = await supabase.from('user_stickers').select('path').eq('user_id', userId);
		// const urls = data.map(d => d.path);

		const publicDir = path.join(process.cwd(), "public");
		const uploadDir = path.join(publicDir, "uploads", "stickers", userId);
		
		let urls: string[] = [];
		try {
			const files = await fs.readdir(uploadDir);
			// Sort files by creation time or just reverse so newest is first
			const fileStats = await Promise.all(
				files.map(async (file) => {
					const stat = await fs.stat(path.join(uploadDir, file));
					return { file, mtime: stat.mtime.getTime() };
				})
			);
			fileStats.sort((a, b) => b.mtime - a.mtime);
			urls = fileStats.map(f => `/uploads/stickers/${userId}/${f.file}`);
		} catch (err: any) {
			// If directory doesn't exist, it means user hasn't uploaded anything yet
			if (err.code !== "ENOENT") {
				throw err;
			}
		}

		return NextResponse.json({ urls });
	} catch (error) {
		console.error("Error fetching stickers:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
