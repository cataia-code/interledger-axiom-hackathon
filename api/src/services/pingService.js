let count = 0;

export function ping() {
  count += 1;
  return { message: 'pong', count };
}
