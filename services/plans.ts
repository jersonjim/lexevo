export type Plan = {
  id: string;
  boxCount: number;
  nameKey: string;
  descKey: string;
  emoji: string;
  color: string;
  bg: string;
  recommended?: boolean;
  dailyLimit: number;
};

export const PLANS: Plan[] = [
  {
    id: 'bronze',
    boxCount: 3,
    nameKey: 'plans.bronze',
    descKey: 'plans.bronzeDesc',
    emoji: '🥉',
    color: '#92400E',
    bg: '#FEF3C7',
    dailyLimit: 5,
  },
  {
    id: 'silver',
    boxCount: 5,
    nameKey: 'plans.silver',
    descKey: 'plans.silverDesc',
    emoji: '🥈',
    color: '#475569',
    bg: '#F1F5F9',
    recommended: true,
    dailyLimit: 10,
  },
  {
    id: 'golden',
    boxCount: 7,
    nameKey: 'plans.golden',
    descKey: 'plans.goldenDesc',
    emoji: '🥇',
    color: '#B45309',
    bg: '#FFFBEB',
    dailyLimit: 20,
  },
];

export function getPlan(boxCount: number): Plan {
  return PLANS.find((p) => p.boxCount === boxCount) ?? PLANS[1];
}

export function getPlanById(planId: string): Plan {
  return PLANS.find((p) => p.id === planId) ?? PLANS[1];
}
