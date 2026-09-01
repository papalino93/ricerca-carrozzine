import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { addUser, listUsers, removeUser, resetPassword } from "@/lib/users";
import { disableTwoFactor } from "@/lib/twofactor";

export const runtime = "nodejs";

// Protetta dal proxy E da un controllo proprio in ogni gestore (difesa in
// profondità): il matcher del proxy è una singola regex scritta a mano, e
// questa rotta può creare account amministratore — non deve dipendere da
// un solo punto di controllo.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

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
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

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
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

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
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Username obbligatorio" }, { status: 400 });
    }
    const users = await removeUser(username);
    // Best-effort: se lo username venisse riassegnato in futuro a un'altra
    // persona, non deve ereditare il secret 2FA di chi non ha più accesso.
    await disableTwoFactor(username).catch(() => {});
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
