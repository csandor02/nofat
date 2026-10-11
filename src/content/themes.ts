import type { ThemeId } from '../lib/types';
export const themes: Array<{ id: ThemeId; title: string; note: string }> = [
  { id: 'keep_your_word', title: 'Keep your word', note: 'The most convincing promise is the one kept quietly.' },
  { id: 'ordinary_excellence', title: 'Ordinary excellence', note: 'Nothing dramatic. Just the work, done well.' },
  { id: 'long_game', title: 'The long game', note: 'One good week, and then another.' },
  { id: 'quiet_work', title: 'Quiet work', note: 'The ledger notices even when nobody else does.' },
];
