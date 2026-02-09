import { type ChallengeTemplate } from './db';

/**
 * Challenge Templates - Seed data for Challenge-Led Growth Engine
 * Three flagship challenges designed for maximum stickiness and retention
 */

/**
 * Hebrew translations for challenges
 * Localized for Israeli running community with culturally-appropriate messaging
 */
const CHALLENGE_TRANSLATIONS = {
  'start-running': {
    he: {
      name: '21 יום להתחיל לרוץ',
      tagline: 'מאפס ועד 30 דקות ריצה רצופה',
      description: 'מושלם למתחילים לגמרי. בנו הרגל ריצה בלי שום לחץ. נלווה אתכם מהצעדים הראשונים ועד ריצה בטוחה ונוחה של 30 דקות.',
      targetAudience: 'רצים חדשים לגמרי שמתמודדים עם פחד וחוסר עקביות',
      promise: 'תעברו מ"אני לא יכול לרוץ" ל"אני רץ" תוך 21 יום בלבד',
      workoutPattern: 'יחסי הליכה/ריצה הדרגתיים, מתחילים ב-1 דקת ריצה / 2 דקות הליכה ובונים בהדרגה ל-30 דקות ריצה רצופה. הדגש על עקביות ולא על עצימות.',
      dailyThemes: [
        'יום 1: פשוט להגיע — המטרה היחידה היום היא להתחיל',
        'יום 2: חוגגים שהופעתם פעמיים',
        'יום 3: בונים מומנטום — שלושה ימים זה כבר דפוס',
        'יום 4: אתם עושים את זה!',
        'יום 5: חמישה ימים יותר חזקים',
        'יום 6: כמעט שבוע',
        'יום 7: השבוע הראשון הושלם! אתם רצים עכשיו',
        'יום 8: מתחילים חזק שוב',
        'יום 9: מוצאים את הקצב',
        'יום 10: ספרות כפולות!',
        'יום 11: יותר ממקרה',
        'יום 12: הגוף שלכם מסתגל',
        'יום 13: יום 13 המזל',
        'יום 14: נקודת ציון באמצע — ראו כמה רחוק הגעתם',
        'יום 15: עברנו את האמצע',
        'יום 16: זיכרון שרירים נבנה',
        'יום 17: אתם עקביים עכשיו',
        'יום 18: שלושה ימים מהיסטוריה',
        'יום 19: כמעט שם',
        'יום 20: דחיפה אחרונה',
        'יום 21: הצלחתם! אתם רצים עכשיו',
      ],
    },
  },
  'morning-ritual': {
    he: {
      name: 'ריצת בוקר מודרכת — 21 יום',
      tagline: 'הפכו את הריצה לטקס בוקר רגוע',
      description: 'לרצים שרוצים יותר מסתם אימון. הפכו את ריצת הבוקר שלכם לתרגול מיינדפולנס שקובע את הטון ליום כולו. כולל הנחיות נשימה, נקודות מיקוד ושאלות להתבוננות.',
      targetAudience: 'רצים מזדמנים שמחפשים משמעות, שגרה ובהירות נפשית',
      promise: 'התחילו כל יום ממורכזים, בעלי אנרגיה ותחושת הישג',
      workoutPattern: 'ריצות בוקר בקצב נוח (30-40 דקות) עם הנחיות מיינדפולנס, תרגילי נשימה וקביעת כוונות. ההתמקדות בחוויה, לא בקצב.',
      dailyThemes: [
        'יום 1: קבעו את הכוונה — מה אתם רוצים מ-21 הימים האלה?',
        'יום 2: שימו לב לנשימה',
        'יום 3: תרגול הוקרת תודה בבוקר',
        'יום 4: מודעות לסריקת גוף',
        'יום 5: למצוא שקט בתנועה',
        'יום 6: קצב נשימה',
        'יום 7: שבוע ראשון של נוכחות',
        'יום 8: קביעת כוונות יומיות',
        'יום 9: מעברים מודעים',
        'יום 10: התבוננות בלי שיפוט',
        'יום 11: העוגן של הבוקר שלכם',
        'יום 12: הנשימה כמדריך',
        'יום 13: השתקפות באמצע הדרך',
        'יום 14: אפקט המדיטציה',
        'יום 15: ריצה כמדיטציה',
        'יום 16: מודעות לרגע הנוכחי',
        'יום 17: הטקס האישי שלכם',
        'יום 18: עקביות יוצרת רוגע',
        'יום 19: כמעט הושלם',
        'יום 20: מחר זה יום 21',
        'יום 21: הטקס הבוקר הושלם — זה מי שאתם עכשיו',
      ],
    },
  },
  'plateau-breaker': {
    he: {
      name: 'פורצי פלטו — 21 יום',
      tagline: 'תרגישו התקדמות שוב תוך 3 שבועות',
      description: 'תקועים באותן 3 ריצות בשבוע? בואו נפרוץ את זה עם גיוון מובנה. נציג סטריידים, עליות ועבודת טמפו קלה כדי להצית מחדש את ההתקדמות שלכם. מונע נתונים ומסתגל.',
      targetAudience: 'רצים מזדמנים תקועים באותה שגרה כבר 3+ חודשים',
      promise: 'פרצו לרמת כושר חדשה עם אימון חכם ומתקדם',
      workoutPattern: 'שילוב אסטרטגי של ריצות קלות (60%), עבודת מהירות (20%) ואימוני עליות (20%). מציג סטריידים, פארטלק ומאמצי סף. קושי מסתגל על בסיס משוב.',
      dailyThemes: [
        'יום 1: ריצת אבחון — בואו נראה איפה אתם נמצאים',
        'יום 2: קו בסיס קל',
        'יום 3: סטריידים ראשונים',
        'יום 4: התאוששות חשובה',
        'יום 5: בניית בסיס אירובי',
        'יום 6: מנוחה עם מטרה',
        'יום 7: אימון מהירות ראשון — 4×400 מטר',
        'יום 8: התאוששות פעילה',
        'יום 9: היכרות עם טמפו',
        'יום 10: ריצה קלה',
        'יום 11: אימון עליות',
        'יום 12: התאוששות',
        'יום 13: כיף של פארטלק',
        'יום 14: בדיקה באמצע — מרגישים את ההבדל?',
        'יום 15: סיבולת קלה',
        'יום 16: אימון מהירות 2',
        'יום 17: התאוששות',
        'יום 18: התקדמות בטמפו',
        'יום 19: ריצה קלה',
        'יום 20: אימון מהירות אחרון',
        'יום 21: הפריצה אושרה — אתם יותר מהירים עכשיו',
      ],
    },
  },
} as const;

/**
 * Get localized challenge template
 */
export function getLocalizedChallenge(
  slug: string,
  locale: 'en' | 'he'
): Partial<ChallengeTemplate> | undefined {
  if (locale === 'he' && CHALLENGE_TRANSLATIONS[slug as keyof typeof CHALLENGE_TRANSLATIONS]?.he) {
    return CHALLENGE_TRANSLATIONS[slug as keyof typeof CHALLENGE_TRANSLATIONS].he;
  }
  return undefined;
}

export const CHALLENGE_TEMPLATES: Omit<ChallengeTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'start-running',
    name: '21-Day Start Running',
    tagline: 'From zero to running 30 minutes comfortably',
    description: 'Perfect for brand-new runners. Build a sustainable running habit with zero pressure. We\'ll guide you from your first steps to running confidently for 30 minutes.',
    targetAudience: 'brand-new runners struggling with fear and inconsistency',
    promise: 'You\'ll transform from "I can\'t run" to "I\'m a runner" in just 21 days',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'habit',
    workoutPattern: 'Progressive walk/run ratios starting with 1min run / 2min walk, gradually building to continuous 30min runs. Emphasis on consistency over intensity.',
    coachTone: 'gentle',
    dailyThemes: [
      'Day 1: Just show up - Your only goal today is to start',
      'Day 2: Celebrate showing up twice',
      'Day 3: Building momentum - Three days makes a pattern',
      'Day 4: You\'re doing this!',
      'Day 5: Five days stronger',
      'Day 6: Almost a week',
      'Day 7: First week complete! You\'re a runner now',
      'Day 8: Starting strong again',
      'Day 9: Finding your rhythm',
      'Day 10: Double digits!',
      'Day 11: More than a fluke',
      'Day 12: Your body is adapting',
      'Day 13: Lucky day 13',
      'Day 14: Halfway milestone - Look how far you\'ve come',
      'Day 15: Over the hump',
      'Day 16: Muscle memory building',
      'Day 17: You\'re consistent now',
      'Day 18: Three days from history',
      'Day 19: Almost there',
      'Day 20: Final push',
      'Day 21: You did it! You\'re a runner now',
    ],
    thumbnailUrl: '/images/challenges/start-running.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: 'morning-ritual',
    name: '21-Day Morning Guided Run',
    tagline: 'Turn running into a calm morning ritual',
    description: 'For runners who want more than exercise. Transform your morning runs into a mindful practice that sets the tone for your entire day. Includes guided breathing, focus cues, and reflection prompts.',
    targetAudience: 'casual runners seeking meaning, routine, and mental clarity',
    promise: 'Start every day centered, energized, and with a sense of accomplishment',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'mindful',
    workoutPattern: 'Easy-paced morning runs (30-40min) with guided mindfulness cues, breathing exercises, and intention-setting. Focus on the experience, not the pace.',
    coachTone: 'calm',
    dailyThemes: [
      'Day 1: Set your intention - What do you want from these 21 days?',
      'Day 2: Notice your breath',
      'Day 3: Morning gratitude practice',
      'Day 4: Body scan awareness',
      'Day 5: Finding stillness in motion',
      'Day 6: Breathing rhythm',
      'Day 7: First week of presence',
      'Day 8: Setting daily intentions',
      'Day 9: Mindful transitions',
      'Day 10: Observing without judgment',
      'Day 11: Your morning anchor',
      'Day 12: Breath as your guide',
      'Day 13: Halfway reflection',
      'Day 14: The meditation effect',
      'Day 15: Running as meditation',
      'Day 16: Present moment awareness',
      'Day 17: Your personal ritual',
      'Day 18: Consistency creates calm',
      'Day 19: Almost complete',
      'Day 20: Tomorrow is day 21',
      'Day 21: Morning ritual complete - This is who you are now',
    ],
    thumbnailUrl: '/images/challenges/morning-ritual.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 2,
  },
  {
    slug: 'plateau-breaker',
    name: '21-Day Plateau Breaker',
    tagline: 'Feel progress again in 3 weeks',
    description: 'Stuck at the same 3 runs per week? Break through with structured variety. Introduce strides, hills, and easy tempo work to reignite your progress. Data-driven and adaptive.',
    targetAudience: 'casual runners stuck at same routine for 3+ months',
    promise: 'Breakthrough to a new level of fitness with smart, progressive training',
    durationDays: 21,
    difficulty: 'intermediate',
    category: 'performance',
    workoutPattern: 'Strategic mix of easy runs (60%), speed work (20%), and hill sessions (20%). Introduces strides, fartlek, and threshold efforts. Adaptive difficulty based on feedback.',
    coachTone: 'analytical',
    dailyThemes: [
      'Day 1: Diagnostic run - Let\'s see where you are',
      'Day 2: Easy baseline',
      'Day 3: First strides',
      'Day 4: Recovery matters',
      'Day 5: Building aerobic base',
      'Day 6: Rest with purpose',
      'Day 7: First speed session - 4x400m',
      'Day 8: Active recovery',
      'Day 9: Tempo introduction',
      'Day 10: Easy run',
      'Day 11: Hills workout',
      'Day 12: Recovery',
      'Day 13: Fartlek fun',
      'Day 14: Halfway check-in - Feeling the difference?',
      'Day 15: Easy endurance',
      'Day 16: Speed session 2',
      'Day 17: Recovery',
      'Day 18: Tempo progression',
      'Day 19: Easy run',
      'Day 20: Final speed session',
      'Day 21: Breakthrough confirmed - You\'re faster now',
    ],
    thumbnailUrl: '/images/challenges/plateau-breaker.jpg',
    isActive: true,
    isFeatured: true,
    sortOrder: 3,
  },
];

/**
 * Get all active challenge templates sorted by sort order
 */
export function getActiveChallengeTemplates(): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get featured challenge templates for promotion
 */
export function getFeaturedChallengeTemplates(): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.isFeatured).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get challenge template by slug
 */
export function getChallengeTemplateBySlug(slug: string): (typeof CHALLENGE_TEMPLATES)[0] | undefined {
  return CHALLENGE_TEMPLATES.find(t => t.slug === slug);
}

/**
 * Get all challenge slugs for static generation
 */
export function getAllChallengeSlugs(): string[] {
  return CHALLENGE_TEMPLATES.map(template => template.slug);
}

/**
 * Get challenge templates by category
 */
export function getChallengeTemplatesByCategory(category: ChallengeTemplate['category']): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get challenge templates by difficulty
 */
export function getChallengeTemplatesByDifficulty(difficulty: ChallengeTemplate['difficulty']): typeof CHALLENGE_TEMPLATES {
  return CHALLENGE_TEMPLATES.filter(t => t.isActive && t.difficulty === difficulty).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get recommended next challenge based on completed challenge
 */
export function getNextChallengeRecommendation(completedSlug: string): (typeof CHALLENGE_TEMPLATES)[0] | null {
  const progressionPaths: Record<string, string> = {
    'start-running': 'morning-ritual',      // Habit → Mindful
    'morning-ritual': 'plateau-breaker',    // Mindful → Performance
    'plateau-breaker': null,                // End of progression (custom goals next)
  };

  const nextSlug = progressionPaths[completedSlug];
  if (!nextSlug) return null;

  return getChallengeTemplateBySlug(nextSlug) || null;
}
