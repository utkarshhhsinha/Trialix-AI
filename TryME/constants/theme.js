// TrialX AI — Warm Pastel Design System
// "Cozy · Classy · Fashion-forward"

export const theme = {
  colors: {
    // ── Backgrounds (warm, creamy)
    bg: '#FAF7F4',           // Warm off-white
    bgWarm: '#F5EDE4',       // Warm peach tint
    surface: '#FFFFFF',      // Pure white cards
    surfaceWarm: '#FEF9F5',  // Very light warm

    // ── Primary — Warm Terracotta
    primary: '#C4785A',
    primaryLight: '#EEC4AA',
    primaryDark: '#A05A3E',
    primaryBg: '#FDF2EC',

    // ── Accent — Warm Honey/Camel
    accent: '#C49A6C',
    accentLight: '#EDD5B0',
    accentBg: '#FDF6EC',

    // ── Text
    text: '#2A1F1A',
    textSecondary: '#7A6055',
    textMuted: '#B8A49A',
    textDark: '#2A1F1A',
    textLight: '#7A6055',

    // ── Borders & dividers
    border: '#EDE0D4',
    borderLight: '#F7F0EB',

    // ── Semantic
    success: '#6B9E7A',
    successLight: '#D4EDD9',
    danger: '#C4604A',
    dangerLight: '#F5D5CC',
    gold: '#C49A6C',

    // ── Match / Swipe colours (warm versions)
    matchGreen: '#6B9E7A',
    matchGreenGlow: 'rgba(107,158,122,0.3)',
    skipRed: '#C4604A',

    // ── Warm neutrals
    warmWhite: '#FEFCFA',
    warmGray: '#EDE0D4',
    warmGrayMid: '#D4C4B8',

    // ── Gradient definitions
    gradientPrimary: ['#C4785A', '#E8A882'],
    gradientAccent: ['#C49A6C', '#E8C89A'],
    gradientWarm: ['#FAF7F4', '#F5EDE4'],
    gradientCard: ['transparent', 'rgba(42,31,26,0.88)'],
    gradientOverlay: ['rgba(42,31,26,0.4)', 'transparent'],

    // ── Legacy (compatibility)
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

  fonts: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
  },

  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
    xxxl: 32,
    pill: 100,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
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

  matchCopy: [
    'You + this outfit = dangerous combo.',
    'The algorithm never lies.',
    'Your aura said yes.',
    'The fit knew before you did.',
    'Slay incoming.',
  ],
};

export default theme;
