export type MemeEvent = 'welcome' | 'plan_locked' | 'training_logged' | 'goal_complete' | 'checkin_missing' | 'win' | 'tie' | 'no_contest' | 'recovery_pause';
export type Meme = { id: string; event: MemeEvent; tone: 'quiet' | 'locker_room'; text: string; alt: string; asset?: string; sourceUrl?: string };

export const memes: Meme[] = [
  { id: 'welcome-1', event: 'welcome', tone: 'quiet', text: 'A private club for public levels of commitment.', alt: 'A welcoming note from the club.' },
  { id: 'welcome-2', event: 'welcome', tone: 'locker_room', text: 'The dress code is consistency.', alt: 'A welcoming note from the club.' },
  { id: 'lock-1', event: 'plan_locked', tone: 'locker_room', text: 'The ink is dry. The dumbbells are not going to lift themselves.', alt: 'The weekly pact is locked.' },
  { id: 'lock-2', event: 'plan_locked', tone: 'locker_room', text: 'Two signatures. One very dramatic spreadsheet.', alt: 'The weekly pact is locked.' },
  { id: 'training-1', event: 'training_logged', tone: 'locker_room', text: 'The iron has acknowledged your presence.', alt: 'Training was logged.' },
  { id: 'training-2', event: 'training_logged', tone: 'locker_room', text: 'A small win for you. A scheduling crisis for your excuses.', alt: 'Training was logged.' },
  { id: 'goal-1', event: 'goal_complete', tone: 'quiet', text: 'The committee has reviewed the receipts. Approved.', alt: 'A weekly goal is complete.' },
  { id: 'goal-2', event: 'goal_complete', tone: 'locker_room', text: 'An entirely unreasonable amount of tasteful applause.', alt: 'A weekly goal is complete.' },
  { id: 'missing-1', event: 'checkin_missing', tone: 'quiet', text: 'The ledger is open when you are ready.', alt: 'A gentle check-in reminder.' },
  { id: 'missing-2', event: 'checkin_missing', tone: 'locker_room', text: 'Your check-in is pending. Your worth is not.', alt: 'A supportive check-in reminder.' },
  { id: 'win-1', event: 'win', tone: 'locker_room', text: 'An elegant performance. An undignified amount of bragging rights.', alt: 'A celebration for the winner.' },
  { id: 'win-2', event: 'win', tone: 'quiet', text: 'The laurel is temporary. The screenshot is forever.', alt: 'A celebration for the winner.' },
  { id: 'tie-1', event: 'tie', tone: 'locker_room', text: 'Diplomacy has prevailed. Suspiciously.', alt: 'The week ended in a tie.' },
  { id: 'no-contest-1', event: 'no_contest', tone: 'quiet', text: 'A quiet week in the club. We begin again.', alt: 'The week ended without a contest.' },
  { id: 'pause-1', event: 'recovery_pause', tone: 'quiet', text: 'Recovery is part of the programme.', alt: 'The week has been paused for recovery.' },
];

function hash(value: string) { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return result >>> 0; }
export function selectMeme(seed: string, event: MemeEvent, tone: Meme['tone']) {
  const eligible = memes.filter((meme) => meme.event === event && (tone === 'locker_room' || meme.tone === 'quiet'));
  return eligible[hash(seed) % eligible.length] ?? memes[0]!;
}
