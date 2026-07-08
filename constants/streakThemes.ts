export type StreakTheme = {
  id: string;
  nameKey: string;
  stages: string[];
};

export const STREAK_THEMES: StreakTheme[] = [
  { id: 'plant',   nameKey: 'themes.plant',   stages: ['🌱', '🌿', '🌵', '🌳', '🌲', '🌴'] },
  { id: 'dragon',  nameKey: 'themes.dragon',  stages: ['🥚', '🐍', '🦎', '🐲', '🐉', '🔱'] },
  { id: 'rocket',  nameKey: 'themes.rocket',  stages: ['🌑', '🌒', '🌓', '🌕', '⭐', '🌟'] },
  { id: 'flame',   nameKey: 'themes.flame',   stages: ['💧', '🕯️', '🔥', '⚡', '💥', '☀️'] },
  { id: 'lion',    nameKey: 'themes.lion',    stages: ['🐱', '😸', '🐯', '🦁', '👑', '🏆'] },
  { id: 'wizard',  nameKey: 'themes.wizard',  stages: ['👶', '🧒', '🧑', '🧙', '🦸', '✨'] },
  { id: 'ocean',   nameKey: 'themes.ocean',   stages: ['💧', '🐟', '🐠', '🦈', '🐋', '🔱'] },
  { id: 'warrior', nameKey: 'themes.warrior', stages: ['🪨', '🗡️', '⚔️', '🛡️', '🏹', '👑'] },
];

// Streak days needed to reach each stage (index 0..5)
export const STAGE_MILESTONES = [0, 1, 4, 8, 15, 30];

export function getStageIndex(streak: number): number {
  let stage = 0;
  for (let i = 0; i < STAGE_MILESTONES.length; i++) {
    if (streak >= STAGE_MILESTONES[i]) stage = i;
  }
  return stage;
}

export function getMascotEmoji(themeId: string | null, streak: number): string {
  const theme = STREAK_THEMES.find(t => t.id === themeId) ?? STREAK_THEMES[0];
  return theme.stages[getStageIndex(streak)];
}
