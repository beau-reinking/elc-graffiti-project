const DAY = 24 * 60 * 60 * 1000;

export function canLike(post, actor) {
  return post?.value.type === 'shared' && post.actor !== actor &&
    post.value.audience.includes(actor);
}

export function practicePoints(objects, owner, blocked = []) {
  const sessions = new Map();
  const shares = new Map();
  for (const row of objects) {
    if (row.actor !== owner) continue;
    if (row.value.type === 'practice') sessions.set(row.url, row);
    if (row.value.type === 'shared') shares.set(row.url, row);
  }

  const likesBySource = new Map();
  for (const row of objects) {
    if (row.value.type !== 'like' || blocked.includes(row.actor)) continue;
    const share = shares.get(row.value.post);
    if (!canLike(share, row.actor) || row.value.createdAt < share.value.createdAt) continue;
    const source = share.value.source;
    if (!sessions.has(source)) continue;
    if (!likesBySource.has(source)) likesBySource.set(source, new Set());
    likesBySource.get(source).add(row.actor);
  }

  const unique = new Map();
  const ordered = [...sessions.values()].sort((a, b) =>
    a.value.createdAt - b.value.createdAt || a.url.localeCompare(b.url));
  for (const row of ordered) {
    const key = row.value.operationId ? `operation:${row.value.operationId}` : row.url;
    if (!unique.has(key)) unique.set(key, { row, urls: [], likers: new Set() });
    const session = unique.get(key);
    session.urls.push(row.url);
    for (const liker of likesBySource.get(row.url) ?? []) session.likers.add(liker);
  }

  const bySession = new Map();
  let total = 0;
  let previousDay;
  let streak = 0;
  for (const { row, urls, likers } of unique.values()) {
    const day = Math.floor(row.value.createdAt / DAY);
    if (day !== previousDay) {
      streak = previousDay === day - 1 ? streak + 1 : 1;
      previousDay = day;
    }
    const seconds = Math.max(0, row.value.duration);
    const duration = Math.min(30, seconds / 60);
    const measured = row.value.audioActivitySeconds;
    const activity = Number.isFinite(measured) && seconds > 0
      ? 100 * Math.min(seconds, Math.max(0, measured)) / seconds
      : 80;
    const multiplier = 1 + 0.02 * Math.min(5, streak - 1);
    const points = Math.max(1, Math.round((duration * activity + 3 * likers.size) * multiplier));
    for (const url of urls) bySession.set(url, points);
    total += points;
  }
  return { bySession, total };
}
