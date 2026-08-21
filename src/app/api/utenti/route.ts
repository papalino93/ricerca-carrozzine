import { NextRequest, NextResponse } from "next/server";
import { addUser, listUsers, removeUser, resetPassword } from "@/lib/users";

export const runtime = "nodejs";

// Protetta dal proxy (stessa Basic Auth dell'admin).
export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username: string;
      password: string;
    };
    const users = await addUser(username, password);
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username: string;
      password: string;
    };
    const users = await resetPassword(username, password);
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Username obbligatorio" }, { status: 400 });
    }
    const users = await removeUser(username);
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
