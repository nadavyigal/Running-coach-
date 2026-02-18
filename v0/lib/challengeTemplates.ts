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
      tagline: '21 יום. ללא ניסיון. תהיה רץ.',
      description: 'כל מי שרץ היום התחיל פעם אחת. הפחד, חוסר הזמן, ה"אני לא מסוג הרצים" — כולם עברו את זה. האתגר הזה בנוי בדיוק לשם. שלושה שבועות של צעדים קטנים, מוכוונות AI, ופתאום אתה רץ.',
      targetAudience: 'אנשים שתמיד רצו לרוץ אבל לא ידעו מאיפה להתחיל',
      promise: 'ביום 21 תסיים 21 ריצות, תבנה הרגל אמיתי, ותשתיק את הקול שאמר שאתה לא יכול.',
      workoutPattern: 'יחסי הליכה/ריצה הדרגתיים — מתחילים ב-1 דקת ריצה / 2 דקות הליכה ובונים עד ל-30 דקות ריצה רצופה. הדגש על להגיע, לא על מהירות.',
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
      tagline: 'הבוקרים שלך עומדים להשתנות. 21 יום לריצה שמייצבת אותך.',
      description: 'לא עוד "עוד 5 דקות". ריצת הבוקר הנכונה לא מתישה — היא מאירה את שאר היום. 21 יום של ריצה מודרכת עם מיינדפולנס, נשימה, וכוונות שמכינות אותך לכל מה שיבוא.',
      targetAudience: 'רצים מזדמנים שמחפשים שגרה, משמעות ובהירות נפשית בבוקר',
      promise: 'תתחיל כל יום ממורכז, עם אנרגיה ותחושת הישג — לפני שיום העבודה בכלל מתחיל.',
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
      tagline: 'תקוע באותו קצב? 21 יום למהיר יותר — בניהול AI ומבוסס נתונים.',
      description: 'אותן שלוש ריצות בשבוע, אותו קצב, אותה תחושה שאתה תקוע. הגיע הזמן לשנות. הAI מנתח את האימונים שלך ומוסיף בדיוק מה שהגוף שלך צריך — סטריידים, עליות, טמפו — עד שאתה מרגיש את ההבדל.',
      targetAudience: 'רצים שרצים כבר כמה חודשים ולא רואים התקדמות',
      promise: 'פרוץ לרמת כושר חדשה עם אימון חכם שמסתגל בדיוק לגוף שלך.',
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
    tagline: '21 days. No experience needed. You\'ll be a runner.',
    description: 'Everyone who runs today started exactly once. The fear, the "I\'m not a runner" voice, the not knowing where to begin — all of it is normal, and none of it has to stop you. This challenge was built for that moment. Three weeks of small, guided steps. An AI coach that adjusts to how you feel. And on day 21, you\'ll wonder why you waited.',
    targetAudience: 'people who always wanted to run but never knew how to start',
    promise: 'By Day 21, you\'ll have completed 21 runs, built a real habit, and silenced the voice that said you couldn\'t.',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'habit',
    workoutPattern: 'Progressive walk/run intervals — starting with 1 min run / 2 min walk, building to 30 continuous minutes. The goal is showing up, not speed. Every session adapts to how you felt yesterday.',
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
    tagline: 'Your mornings are about to change. 21 days to a run that grounds you.',
    description: 'Not another exhausting workout before coffee. The right morning run doesn\'t drain you — it sets the tone for everything that follows. 21 days of guided runs with mindfulness cues, breathing exercises, and daily intentions that leave you feeling clear, energized, and ahead of your day before it starts.',
    targetAudience: 'casual runners seeking meaning, routine, and mental clarity in the morning',
    promise: 'Start every day centered, energized, and with a sense of accomplishment — before your workday even begins.',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'mindful',
    workoutPattern: 'Easy-paced morning runs (30-40min) with guided mindfulness cues, breathing exercises, and intention-setting. Focus on the experience, not the pace. Your coach adapts based on how rested you feel.',
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
    tagline: 'Stuck at the same pace? 21 days to faster — AI-coached, data-driven.',
    description: 'Same three runs per week. Same pace. Same feeling of going nowhere. You\'re not lazy — you\'re undertrained in the right ways. This challenge analyzes your pattern and adds exactly what\'s missing: strides, hills, and tempo work timed precisely to when your body is ready. Three weeks in, you\'ll feel the difference on every run.',
    targetAudience: 'casual runners stuck at the same routine for 3+ months who want measurable progress',
    promise: 'Break through to a new fitness level with smart, progressive training that adapts to your data — not a one-size plan.',
    durationDays: 21,
    difficulty: 'intermediate',
    category: 'performance',
    workoutPattern: 'Strategic mix of easy runs (60%), speed work (20%), and hill sessions (20%). Introduces strides, fartlek, and threshold efforts. Difficulty adapts based on your post-run feedback.',
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
