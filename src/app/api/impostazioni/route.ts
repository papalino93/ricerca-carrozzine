import { NextResponse } from "next/server";
import { getSettings, saveSettings, type CompanySettings } from "@/lib/settings";

export const runtime = "nodejs";

// Protetta dal middleware (stessa Basic Auth dell'admin).
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompanySettings;
    await saveSettings(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
