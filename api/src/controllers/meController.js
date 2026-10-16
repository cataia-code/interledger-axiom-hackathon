export function getMe(req, res) {
  const { id, email, name, role, emailVerified } = req.auth.user;
  res.json({ user: { id, email, name, role, emailVerified } });
}
