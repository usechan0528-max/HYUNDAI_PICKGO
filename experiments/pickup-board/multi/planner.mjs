// Directed, complete matrix; exhaustive search is deliberately bounded to six stops.
export function bestOrder(order, matrix, { final = false, active = null, arrived = false } = {}) {
  if (!Array.isArray(order) || order.length > 6 || new Set(order).size !== order.length) throw new Error('INVALID_ORDER');
  const nodes = ['origin', ...order, ...(final ? ['destination'] : [])];
  for (const a of nodes) for (const b of nodes) if (a !== b) {
    if (!Number.isSafeInteger(matrix?.[a]?.[b]) || matrix[a][b] < 0 || matrix[a][b] > 604800) throw new Error('ROUTE_MISSING');
  }
  const cost = list => {
    // Manual arrival means the origin-to-active leg has already been travelled.
    const route = [...(active && arrived ? [] : ['origin']), ...list, ...(final ? ['destination'] : [])];
    return route.slice(1).reduce((sum, to, i) => sum + matrix[route[i]][to], 0);
  };
  let best = [...order], total = cost(order);
  function visit(prefix, remaining) {
    if (!remaining.length) { const value = cost(prefix); if (value < total) { best = prefix; total = value; } return; }
    for (const id of remaining) visit([...prefix, id], remaining.filter(x => x !== id));
  }
  if (active && order[0] !== active) throw new Error('INVALID_ACTIVE');
  visit(active ? [active] : [], active ? order.slice(1) : order);
  return { order: best, seconds: total, currentSeconds: cost(order) };
}

export function demoMatrix({ order, now }) {
  // Synthetic directed costs, unrelated to the real coordinates or road network.
  const nodes = ['origin', ...order, 'destination'];
  return { mode: 'demo', source: '합성 방향별 이동시간 · 실제 도로 아님', observedAt: now,
    expiresAt: now + 60000, matrix: Object.fromEntries(nodes.map((a, i) => [a,
      Object.fromEntries(nodes.map((b, j) => [b, i === j ? 0 : 60 + ((i * 7 + j * 13) % 11) * 45]))])) };
}
