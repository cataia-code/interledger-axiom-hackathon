import { updateProfile } from '../services/profileService.js';
import { countryName } from '../services/countries.js';

const present = ({ id, email, name, role, emailVerified, phone, country }) => ({
  id: Number(id),
  email,
  name,
  role,
  emailVerified,
  phone: phone ?? null,
  country: country ?? null,
  countryName: countryName(country),
});

export function getMe(req, res) {
  res.json({ user: present(req.auth.user) });
}

export async function patchMe(req, res, next) {
  try {
    res.json({ user: present(await updateProfile(req.auth.user.id, req.body)) });
  } catch (err) {
    next(err);
  }
}
