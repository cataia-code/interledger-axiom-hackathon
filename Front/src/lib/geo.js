const radians = degrees => degrees * Math.PI / 180;
export function validCoordinates(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
export function distanceMeters(from, to) {
  if (!validCoordinates(from) || !validCoordinates(to)) return null;
  const a = Math.sin(radians(to.lat - from.lat) / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(radians(to.lng - from.lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
