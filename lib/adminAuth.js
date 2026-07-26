export function isAdminRequest(req) {
  const cookie = req.cookies && req.cookies.vault_admin;
  return Boolean(cookie) && cookie === process.env.ADMIN_SESSION_SECRET;
}
