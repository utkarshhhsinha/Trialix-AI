export const theme = {
  colors: {
    bg: '#FAF7F4',
    bgWarm: '#F5EDE4',
    surface: '#FFFFFF',
    surfaceWarm: '#FEF9F5',

    primary: '#C4785A',
    primaryLight: '#EEC4AA',
    primaryDark: '#A05A3E',
    primaryBg: '#FDF2EC',

    accent: '#C49A6C',
    accentLight: '#EDD5B0',
    accentBg: '#FDF6EC',

    text: '#2A1F1A',
    textSecondary: '#7A6055',
    textMuted: '#B8A49A',
    textDark: '#2A1F1A',
    textLight: '#7A6055',

    border: '#EDE0D4',
    borderLight: '#F7F0EB',

    success: '#6B9E7A',
    successLight: '#D4EDD9',
    danger: '#C4604A',
    dangerLight: '#F5D5CC',
    gold: '#C49A6C',

    matchGreen: '#6B9E7A',
    matchGreenGlow: 'rgba(107,158,122,0.3)',
    skipRed: '#C4604A',

    warmWhite: '#FEFCFA',
    warmGray: '#EDE0D4',
    warmGrayMid: '#D4C4B8',

    secondary: '#FFFFFF',
    dark: '#2A1F1A',
    darkLight: '#EDE0D4',
    gray: '#B8A49A',
    white: '#FFFFFF',
    rose: '#C4785A',
    roseLight: '#EEC4AA',
    primaryGlow: 'rgba(196,120,90,0.2)',
    ai: '#C49A6C',
    aiGlow: 'rgba(196,154,108,0.2)',
  },
  personalities: [
    { id: 'clean_girl',     label: 'Clean Girl',      emoji: '🤍' },
    { id: 'streetcore',     label: 'Streetcore',      emoji: '🔥' },
    { id: 'old_money',      label: 'Old Money',       emoji: '💎' },
    { id: 'y2k',            label: 'Y2K',             emoji: '✨' },
    { id: 'soft_glam',      label: 'Soft Glam',       emoji: '💄' },
    { id: 'dark_feminine',  label: 'Dark Feminine',   emoji: '🖤' },
    { id: 'minimal_luxury', label: 'Minimal Luxury',  emoji: '🪞' },
    { id: 'korean',         label: 'K-Aesthetic',     emoji: '🌸' },
    { id: 'indie',          label: 'Indie',           emoji: '🎸' },
    { id: 'coquette',       label: 'Coquette',        emoji: '🎀' },
    { id: 'techwear',       label: 'Techwear',        emoji: '⚙️' },
    { id: 'ethnic_royal',   label: 'Ethnic Royal',    emoji: '👑' },
  ],
  ranks: [
    { id: 'rookie',   label: 'Style Rookie',    minPoints: 0,    icon: '○' },
    { id: 'campus',   label: 'Campus Icon',     minPoints: 100,  icon: '◈' },
    { id: 'street',   label: 'Streetwear God',  minPoints: 500,  icon: '◆' },
    { id: 'muse',     label: 'AI Muse',         minPoints: 1000, icon: '✦' },
    { id: 'ultimate', label: 'Ultimate Match',  minPoints: 2500, icon: '★' },
  ],
  aiLoadingCopy: [
    'Finding your perfect fit…',
    'Matching your silhouette…',
    'Styling your energy…',
    'TrialX AI is cooking…',
    'Your fit is loading.',
    'Aura syncing…',
    'Confidence calibration…',
    'This outfit chose YOU.',
  ],
};

export default theme;
