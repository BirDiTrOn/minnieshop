import { NextResponse } from "next/server";

export function middleware(req) {
  const cookie = req.cookies.get("vault_admin")?.value;
  if (cookie !== process.env.ADMIN_SESSION_SECRET) {
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard"],
};
