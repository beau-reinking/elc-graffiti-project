import test from 'node:test';
import assert from 'node:assert/strict';
import { audibleSeconds, estimateUploadActivity, measureAudioBuffer } from '../src/audio-activity.js';
import { canLike, practicePoints } from '../src/practice-points.js';

const owner = 'alice';
const day = Date.UTC(2026, 10, 16);
const row = (url, type, fields, actor = owner, createdAt = day) => ({
  url, actor, value: { type, createdAt, ...fields },
});
const take = (url, createdAt = day, fields = {}) => row(url, 'practice', { duration: 60, ...fields }, owner, createdAt);

test('the audio estimate counts audible windows, including a sustained take', () => {
  const channel = Float32Array.from({ length: 200 }, (_, index) => index < 100 ? 0.0001 : 0.1);
  const buffer = {
    sampleRate: 100, numberOfChannels: 1, length: channel.length, duration: 2,
    getChannelData: () => channel,
  };
  assert.equal(measureAudioBuffer(buffer), 1);
  assert.equal(audibleSeconds(Array(40).fill(0.1), 2), 2);
  assert.equal(audibleSeconds(Array(40).fill(0.0001), 2), 0);
  assert.equal(audibleSeconds([], 2), undefined);
});

test('unsupported upload analysis has a duration-only path', async () => {
  assert.equal(await estimateUploadActivity(new Blob()), undefined);
  const points = practicePoints([take('legacy'), take('invalid', day, { audioActivitySeconds: 'invalid' })], owner);
  assert.equal(points.bySession.get('legacy'), points.bySession.get('invalid'));
  assert.ok(points.total > 0);
});

test('session awards count activity, length, and consecutive practice days', () => {
  const sessions = [
    take('base'), take('activity', day, { audioActivitySeconds: 60 }),
    take('longer', day, { duration: 120 }),
    take('tomorrow', day + 86_400_000, { audioActivitySeconds: 60 }),
    take('later', day + 3 * 86_400_000, { audioActivitySeconds: 60 }),
  ];
  const { bySession, total } = practicePoints(sessions, owner);
  assert.ok(bySession.get('activity') > bySession.get('base'));
  assert.ok(bySession.get('longer') > bySession.get('base'));
  assert.ok(bySession.get('tomorrow') >= bySession.get('activity'));
  assert.equal(bySession.get('later'), bySession.get('activity'));
  assert.equal(total, [...bySession.values()].reduce((sum, value) => sum + value, 0));

  const fullTakes = Array.from({ length: 9 }, (_, index) =>
    take(String(index), day + index * 86_400_000, { duration: 300, audioActivitySeconds: 300 }));
  const full = practicePoints(fullTakes, owner).bySession;
  assert.ok(full.get('1') > full.get('0'));
  assert.equal(full.get('5'), full.get('8'));
  assert.ok(full.get('5') <= full.get('0') * 1.1);
});

test('likes alter the original award once per eligible person and disappear when the share is removed', () => {
  const original = take('practice', day, { operationId: 'save-1' });
  const duplicate = take('replayed-write', day, { operationId: 'save-1' });
  const shared = row('share', 'shared', { source: original.url, audience: [owner, 'bob', 'claire'] });
  const otherShare = row('new-share', 'shared', { source: original.url, audience: [owner, 'bob'] });
  const like = row('like', 'like', { post: shared.url }, 'bob');
  const baseline = practicePoints([original, shared], owner).total;
  const liked = practicePoints([original, shared, like], owner);
  assert.ok(liked.total > baseline);
  assert.equal(liked.bySession.get(original.url), liked.total);
  assert.equal(practicePoints([original, like], owner).total, baseline);
  assert.equal(practicePoints([original, shared, like], owner, ['bob']).total, baseline);
  assert.equal(practicePoints([
    original, duplicate, shared, otherShare, like,
    row('duplicate-like', 'like', { post: shared.url }, 'bob'),
    row('second-copy-like', 'like', { post: otherShare.url }, 'bob'),
    row('unauthorized-like', 'like', { post: shared.url }, 'outsider'),
    row('stale-like', 'like', { post: shared.url }, 'claire', day - 1),
    row('self-like', 'like', { post: shared.url }),
  ], owner).total, liked.total);
  assert.equal(canLike(shared, owner), false);
  assert.equal(canLike(shared, 'outsider'), false);
});
