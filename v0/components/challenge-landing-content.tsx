'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Flame,
  Heart,
  Mail,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getLocalizedChallenge, CHALLENGE_TEMPLATES } from '@/lib/challengeTemplates';
import type { ChallengeTemplate } from '@/lib/db';

type ChallengeTemplateDisplay =
  | ChallengeTemplate
  | Omit<ChallengeTemplate, 'id' | 'createdAt' | 'updatedAt'>;

interface ChallengeLandingContentProps {
  template: ChallengeTemplateDisplay;
  initialLanguage?: 'en' | 'he';
}

const UI_COPY = {
  en: {
    joinFree: 'Join Free',
    startChallenge: 'Start Day 1 — It\'s Free',
    earlyAccessBadge: 'Early access · Free while we grow',
    yourJourney: 'YOUR JOURNEY',
    first7Days: 'First 7 Days',
    moreDays: '+ 14 more days',
    moreDaysShort: '+ 14 more days of guided coaching',
    whatYoullDo: "What You'll Do",
    yourAiCoach: 'Your AI Coach',
    builtFor: 'BUILT FOR',
    theMethod: 'THE METHOD',
    whyItWorks: 'Why It Works',
    readyToStart: 'Ready?',
    day1: 'Start Today.',
    freeEarlyAccess: 'FREE EARLY ACCESS',
    earlyAdopterNote: 'Early adopters get 50% lifetime discount when we launch premium.',
    noCreditCard: 'No credit card. No gym. Just your phone.',
    privacy: 'Privacy',
    terms: 'Terms',
    coachingStyleDesc: 'coaching style with clear cues, steady encouragement, and practical next steps tailored to your progress.',
    // Experience section (replaces fake testimonials)
    experienceLabel: 'THE EXPERIENCE',
    experienceHeadline: 'What Day 21 sounds like.',
    experienceSub: 'These are the kinds of breakthroughs this challenge is designed to create. You could be writing yours.',
    experienceDisclaimer: 'Illustrative stories — not verified reviews. We\'re early.',
    // Progression
    progressionLabel: 'THE FULL JOURNEY',
    progressionHeadline: 'Three challenges. One transformation.',
    progressionSubline: 'Each challenge builds on the last. The path takes roughly 10 weeks.',
    // FAQ
    faqLabel: 'QUESTIONS',
    faqHeadline: 'Everything you\'re wondering',
    // Email capture
    emailPlaceholder: 'Enter your email',
    emailCta: 'Get My Free Plan',
    emailDisclaimer: 'We\'ll send your day-by-day plan. Unsubscribe anytime.',
    setupTime: 'Takes 2 minutes. Free forever.',
    // Stats
    statDays: 'DAYS',
    statLevel: 'LEVEL',
    statCoach: 'COACH STYLE',
    statFree: 'COST',
    statFreeValue: 'FREE',
  },
  he: {
    joinFree: 'הצטרפות חינם',
    startChallenge: 'התחל יום 1 — חינם',
    earlyAccessBadge: 'גישה מוקדמת · חינם בזמן שאנחנו גדלים',
    yourJourney: 'המסע שלכם',
    first7Days: '7 הימים הראשונים',
    moreDays: '+ עוד 14 ימים',
    moreDaysShort: '+ עוד 14 ימים של ריצה מודרכת',
    whatYoullDo: 'מה תעשו',
    yourAiCoach: 'המאמן החכם שלכם',
    builtFor: 'מיועד ל',
    theMethod: 'השיטה',
    whyItWorks: 'למה זה עובד',
    readyToStart: 'מוכן?',
    day1: 'התחל היום.',
    freeEarlyAccess: 'גישה מוקדמת חינם',
    earlyAdopterNote: 'מצטרפים מוקדמים מקבלים 50% הנחה לכל החיים כשנשיק פרימיום.',
    noCreditCard: 'ללא כרטיס אשראי. ללא חדר כושר. רק הטלפון שלך.',
    privacy: 'פרטיות',
    terms: 'תנאים',
    coachingStyleDesc: 'סגנון אימון עם רמזים ברורים, עידוד קבוע וצעדים מעשיים המותאמים להתקדמותך.',
    // Experience section
    experienceLabel: 'החוויה',
    experienceHeadline: 'איך יום 21 נשמע.',
    experienceSub: 'אלה הפריצות שהאתגר הזה מתוכנן לייצר. את שלך אתה יכול לכתוב.',
    experienceDisclaimer: 'סיפורים המחשה — לא ביקורות מאומתות. אנחנו בשלב מוקדם.',
    // Progression
    progressionLabel: 'המסע המלא',
    progressionHeadline: 'שלושה אתגרים. טרנספורמציה אחת.',
    progressionSubline: 'כל אתגר בונה על הקודם. המסע לוקח כ-10 שבועות.',
    // FAQ
    faqLabel: 'שאלות',
    faqHeadline: 'כל מה שאתה תוהה',
    // Email capture
    emailPlaceholder: 'הכנס אימייל',
    emailCta: 'קבל את התוכנית שלי',
    emailDisclaimer: 'נשלח לך תוכנית יומית. ניתן לבטל בכל עת.',
    setupTime: 'לוקח 2 דקות. חינם לתמיד.',
    // Stats
    statDays: 'ימים',
    statLevel: 'רמה',
    statCoach: 'סגנון מאמן',
    statFree: 'עלות',
    statFreeValue: 'חינם',
  },
} as const;

const categoryThemes: Record<
  string,
  { accent: string; accentBg: string; accentBorder: string; glow: string; glowColor: string; icon: typeof Flame; label: string; labelHe: string }
> = {
  habit: {
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400',
    accentBorder: 'border-emerald-400/30',
    glow: 'shadow-emerald-400/20',
    glowColor: '#10b981',
    icon: Flame,
    label: 'BUILD HABIT',
    labelHe: 'בניית הרגל',
  },
  mindful: {
    accent: 'text-violet-400',
    accentBg: 'bg-violet-400',
    accentBorder: 'border-violet-400/30',
    glow: 'shadow-violet-400/20',
    glowColor: '#8b5cf6',
    icon: Heart,
    label: 'MINDFUL',
    labelHe: 'מיינדפולנס',
  },
  performance: {
    accent: 'text-orange-400',
    accentBg: 'bg-orange-400',
    accentBorder: 'border-orange-400/30',
    glow: 'shadow-orange-400/20',
    glowColor: '#f97316',
    icon: Zap,
    label: 'PERFORMANCE',
    labelHe: 'ביצועים',
  },
};

const difficultyConfig: Record<string, { label: string; labelHe: string; dots: number }> = {
  beginner: { label: 'BEGINNER', labelHe: 'מתחיל', dots: 1 },
  intermediate: { label: 'INTERMEDIATE', labelHe: 'בינוני', dots: 2 },
  advanced: { label: 'ADVANCED', labelHe: 'מתקדם', dots: 3 },
};

const formatCoachTone = (tone: string) => {
  if (!tone) return 'Supportive';
  return tone.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Aspirational experience stories — clearly illustrative, not verified reviews
const EXPERIENCE_STORIES: Record<string, { en: { quote: string; persona: string }[]; he: { quote: string; persona: string }[] }> = {
  'start-running': {
    en: [
      {
        quote: "I downloaded 6 running apps before this. None of them got me out the door 21 days straight. Something about the daily AI message made skipping feel harder than going.",
        persona: "Someone who always started but never finished",
      },
      {
        quote: "Day 14 I almost quit. Work was brutal, knees ached. The coach message that morning said exactly what I needed to hear. I finished two days later.",
        persona: "A busy professional who almost gave up at week 2",
      },
      {
        quote: "I was convinced I was 'not a runner.' Never run consistently in my life. Day 21 I ran 28 minutes without stopping.",
        persona: "A 40-something who believed they were too old to start",
      },
    ],
    he: [
      {
        quote: "הורדתי 6 אפליקציות ריצה לפני זה. אף אחת לא הוציאה אותי מהבית 21 ימים ברציפות. משהו בהודעה היומית של ה-AI גרם לדלג להיות קשה יותר מלצאת.",
        persona: "מי שתמיד התחיל ואף פעם לא סיים",
      },
      {
        quote: "ביום 14 כמעט ויתרתי. הברכיים כאבו, העבודה הייתה קשה. הודעת המאמן באותו בוקר אמרה בדיוק מה שהייתי צריך לשמוע.",
        persona: "אדם עסוק שכמעט ויתר בשבוע השני",
      },
      {
        quote: "הייתי בטוח שאני 'לא מסוג הרצים'. ביום 21 רצתי 28 דקות בלי לעצור.",
        persona: "מי שחשב שהוא מבוגר מדי להתחיל",
      },
    ],
  },
  'morning-ritual': {
    en: [
      {
        quote: "I'm a night owl. I've never willingly woken up early in my life. By week two I was up before my alarm — not because I had to, but because I actually wanted the run.",
        persona: "A self-described night owl who hated mornings",
      },
      {
        quote: "The breathing cues changed everything. I used to zone out and just grind. Now my morning run feels like the best 35 minutes of the day.",
        persona: "A runner who ran but never felt anything from it",
      },
      {
        quote: "I started this for fitness. I kept going for the mental clarity. It's the only time of day that's truly mine.",
        persona: "A parent who needed one hour for themselves",
      },
    ],
    he: [
      {
        quote: "אני יצור לילה. מעולם לא קמתי מוקדם מרצון. בשבוע השני כבר הייתי ער לפני האזעקה — לא כי הייתי צריך, אלא כי רציתי את הריצה.",
        persona: "יצור לילה שלא אהב בוקר",
      },
      {
        quote: "הנחיות הנשימה שינו הכל. פעם הייתי זורם בלי לחשוב. עכשיו ריצות הבוקר שלי מרגישות כמו ה-35 דקות הטובות ביותר ביום שלי.",
        persona: "רץ שרץ אבל לא הרגיש כלום",
      },
      {
        quote: "התחלתי את זה בגלל הכושר. המשכתי בגלל הבהירות הנפשית. זה הזמן היחיד ביום שהוא שלי.",
        persona: "הורה שהיה צריך שעה לעצמם",
      },
    ],
  },
  'plateau-breaker': {
    en: [
      {
        quote: "I've been running 3x a week for two years. Every app gave me the same plan. Three weeks in, something measurable changed in my splits.",
        persona: "A consistent runner who stopped improving",
      },
      {
        quote: "The strides on day 3 felt weird. By day 14 they felt natural. Something in my gait shifted and I didn't notice until I looked at my times.",
        persona: "A runner who'd never done structured speed work",
      },
      {
        quote: "I was skeptical of 'AI coaching.' But it actually adjusted my sessions based on how I rated my last run. That's real adaptation — not a static plan.",
        persona: "A data-driven runner who doubted the concept",
      },
    ],
    he: [
      {
        quote: "רצתי 3 פעמים בשבוע כבר שנתיים. כל אפליקציה נתנה לי את אותה התוכנית. אחרי שלושה שבועות, משהו נמדד השתנה.",
        persona: "רץ עקבי שהפסיק להתקדם",
      },
      {
        quote: "הסטריידים ביום 3 הרגישו מוזר. עד יום 14 הם הרגישו טבעיים. משהו בצעידה שלי השתנה.",
        persona: "רץ שמעולם לא עשה עבודת מהירות מובנית",
      },
      {
        quote: "הייתי סקפטי לגבי 'אימון AI'. אבל זה שינה את האימונים שלי בהתבסס על איך שדירגתי את הריצה האחרונה. הסתגלות אמיתית.",
        persona: "רץ מונע נתונים שפקפק במושג",
      },
    ],
  },
};

// Challenge progression for all 3 challenges
const PROGRESSION = [
  { slug: 'start-running', step: 1, enLabel: '21-Day Start Running', heLabel: '21 יום להתחיל לרוץ', enSub: 'Build the Habit', heSub: 'בנה את ההרגל', color: 'emerald' as const },
  { slug: 'morning-ritual', step: 2, enLabel: '21-Day Morning Run', heLabel: 'ריצת בוקר 21 יום', enSub: 'Find Your Why', heSub: 'מצא את הסיבה', color: 'violet' as const },
  { slug: 'plateau-breaker', step: 3, enLabel: '21-Day Plateau Breaker', heLabel: 'פורצי פלטו 21 יום', enSub: 'Break Through', heSub: 'פרוץ קדימה', color: 'orange' as const },
];

const FAQ_ITEMS: Record<string, { en: { q: string; a: string }[]; he: { q: string; a: string }[] }> = {
  'start-running': {
    en: [
      { q: "Is this actually free?", a: "Yes. The 21-day challenge is completely free. No credit card, no trial period. Early adopters who join now get 50% off our premium tier when it launches." },
      { q: "What if I miss a day?", a: "Life happens. Your AI coach acknowledges it and adjusts. Missing one day doesn't reset your streak or your plan — it just moves forward with where you are." },
      { q: "Do I need a smartwatch or Garmin?", a: "No. Your phone's GPS is all you need. RunSmart works entirely on your phone — no wearable required. You can connect a device later if you want." },
      { q: "What happens after the 21 days?", a: "You unlock the Morning Ritual challenge — the next step in your progression. Your habit is built. Now you deepen it." },
      { q: "How is this different from Nike Run Club or Strava?", a: "Those apps give you static plans. RunSmart's AI coach reads your effort and mood after every run and adjusts tomorrow's session. It's the difference between a plan and a coach." },
    ],
    he: [
      { q: "זה באמת חינם?", a: "כן. האתגר של 21 יום חינמי לחלוטין. ללא כרטיס אשראי, ללא תקופת ניסיון. מצטרפים מוקדמים מקבלים 50% הנחה על פרמיום כשנשיק אותו." },
      { q: "מה אם אני מפספס יום?", a: "קורה. המאמן ה-AI מכיר בזה ומסתגל. פספוס יום אחד לא מאפס את הרצף או התוכנית — פשוט ממשיכים מאיפה שאתה." },
      { q: "האם אני צריך שעון חכם או גארמין?", a: "לא. ה-GPS של הטלפון הוא כל מה שאתה צריך. RunSmart עובד לחלוטין על הטלפון — ללא צורך בשעון. אפשר לחבר מכשיר מאוחר יותר אם תרצה." },
      { q: "מה קורה אחרי 21 יום?", a: "אתה פותח את אתגר ריצת הבוקר — הצעד הבא בהתקדמות שלך. ההרגל בנוי. עכשיו מעמיקים אותו." },
      { q: "במה זה שונה מ-Nike Run Club או Strava?", a: "אותן אפליקציות נותנות לך תוכניות סטטיות. המאמן ה-AI של RunSmart קורא את דירוג המאמץ והמצב שלך אחרי כל ריצה ומשנה את המחרת. ההבדל בין תוכנית למאמן." },
    ],
  },
  'morning-ritual': {
    en: [
      { q: "Is this actually free?", a: "Yes. The 21-day challenge is completely free. No credit card, no trial. Early adopters get 50% off when we launch premium." },
      { q: "What time should I run?", a: "The earlier the better for setting your day's tone — but any morning time works. The key is consistency, not the exact hour." },
      { q: "Do I need a smartwatch or Garmin?", a: "No. Phone GPS only. RunSmart tracks your run using your phone and delivers all the mindfulness cues through the app." },
      { q: "I'm not into meditation. Will this feel weird?", a: "The cues are light and practical — not spiritual. Think of it as focused attention, not sitting cross-legged. Runners who 'hate meditation' often love this." },
      { q: "What happens after 21 days?", a: "You're ready for the Plateau Breaker — where you apply that mental clarity to performance training." },
    ],
    he: [
      { q: "זה באמת חינם?", a: "כן. האתגר של 21 יום חינמי לחלוטין. ללא כרטיס אשראי, ללא ניסיון. מצטרפים מוקדמים מקבלים 50% הנחה כשנשיק פרמיום." },
      { q: "באיזה שעה כדאי לרוץ?", a: "ככל שמוקדם יותר, כך טוב יותר לקביעת הטון ליום — אבל כל שעת בוקר עובדת. המפתח הוא עקביות, לא השעה המדויקת." },
      { q: "האם אני צריך שעון חכם או גארמין?", a: "לא. רק GPS של טלפון. RunSmart עוקב אחרי הריצה שלך עם הטלפון ומעביר את כל הנחיות המיינדפולנס דרך האפליקציה." },
      { q: "אני לא אוהב מדיטציה. זה ירגיש מוזר?", a: "ההנחיות קלות ופרקטיות — לא רוחניות. חשוב על זה כתשומת לב ממוקדת, לא ישיבה בצלב." },
      { q: "מה קורה אחרי 21 יום?", a: "אתה מוכן לפורצי פלטו — שם תיישם את הבהירות הנפשית לאימון ביצועים." },
    ],
  },
  'plateau-breaker': {
    en: [
      { q: "Is this actually free?", a: "Yes. The 21-day challenge is completely free. No credit card, no trial. Early adopters get 50% off premium at launch." },
      { q: "What if I miss a day?", a: "The AI coach adjusts. Your training load rebalances so you don't lose the week — just the one session." },
      { q: "Do I need a smartwatch or Garmin?", a: "No, but it helps with accuracy. The challenge works with phone GPS. If you have a Garmin, RunSmart syncs it automatically." },
      { q: "I'm not a fast runner. Is this for me?", a: "Yes. Plateau Breaker isn't about being fast — it's about getting faster than you are now. The starting point doesn't matter, the direction does." },
      { q: "How is this different from Garmin Coach or TrainingPeaks?", a: "Those platforms require a race goal and give you a fixed plan. RunSmart adapts based on your actual recovery and effort feedback — session by session." },
    ],
    he: [
      { q: "זה באמת חינם?", a: "כן. האתגר של 21 יום חינמי לחלוטין. ללא כרטיס אשראי, ללא ניסיון. מצטרפים מוקדמים מקבלים 50% הנחה בהשקת פרמיום." },
      { q: "מה אם אני מפספס יום?", a: "המאמן ה-AI מסתגל. עומס האימון מאוזן מחדש כדי שלא תאבד את השבוע — רק את האימון האחד." },
      { q: "האם אני צריך שעון חכם או גארמין?", a: "לא, אבל זה עוזר לדיוק. האתגר עובד מצוין עם GPS של טלפון. אם יש לך גארמין, RunSmart מסנכרן אותו אוטומטית." },
      { q: "אני לא רץ מהיר. זה בשבילי?", a: "כן. פורצי פלטו לא עוסק במהירות — הוא עוסק בהיות מהיר יותר ממה שאתה עכשיו." },
      { q: "במה זה שונה מ-Garmin Coach או TrainingPeaks?", a: "הפלטפורמות האלה מחייבות אותך להזין מטרת תחרות ונותנות לך תוכנית קבועה. RunSmart מסתגל בהתבסס על ההתאוששות ומשוב המאמץ האמיתי שלך — מאימון לאימון." },
    ],
  },
};

export function ChallengeLandingContent({ template, initialLanguage = 'en' }: ChallengeLandingContentProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<'en' | 'he'>(initialLanguage);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const experienceRef = useRef<HTMLElement>(null);
  const isHebrew = language === 'he';
  const copy = UI_COPY[language];

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const storedLang = localStorage.getItem('challenge_lang');
    const initial =
      urlLang === 'he' || urlLang === 'en'
        ? urlLang
        : storedLang === 'he' || storedLang === 'en'
          ? storedLang
          : initialLanguage;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time mount initialization from URL/localStorage
    setLanguage(initial as 'en' | 'he');
    if (initial !== urlLang) {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', initial);
      window.history.replaceState({}, '', url.toString());
    }
  }, [initialLanguage]);

  useEffect(() => {
    if (!experienceRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void trackAnalyticsEvent('experience_section_viewed', { slug: template.slug, language });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(experienceRef.current);
    return () => observer.disconnect();
  }, [template.slug, language]);

  const setLanguagePreference = (nextLanguage: 'en' | 'he') => {
    setLanguage(nextLanguage);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLanguage);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('challenge_lang', nextLanguage);
      void trackAnalyticsEvent('language_changed', { from: language, to: nextLanguage, location: 'challenge_landing', challenge_slug: template.slug });
    } catch { /* ignore */ }
  };

  let displayTemplate = template;
  if (isHebrew) {
    const localized = getLocalizedChallenge(template.slug, 'he');
    if (localized) {
      displayTemplate = { ...template, ...localized } as ChallengeTemplateDisplay;
    }
  }

  const theme = (categoryThemes[displayTemplate.category] ?? categoryThemes.habit)!;
  const difficulty = (difficultyConfig[displayTemplate.difficulty] ?? { label: 'BEGINNER', labelHe: 'מתחיל', dots: 1 })!;
  const previewThemes = displayTemplate.dailyThemes.slice(0, 7);
  const CategoryIcon = theme.icon;
  const stories = EXPERIENCE_STORIES[displayTemplate.slug]?.[language] ?? EXPERIENCE_STORIES['start-running']![language]!;
  const faqSet = FAQ_ITEMS[displayTemplate.slug]?.[language] ?? FAQ_ITEMS['start-running']![language]!;
  const difficultyLabel = isHebrew ? difficulty.labelHe : difficulty.label;
  const themeLabel = isHebrew ? theme.labelHe : theme.label;
  const profileFocus = [
    isHebrew ? 'שומר עקביות גם בשבוע עמוס' : 'Stays consistent even in busy weeks',
    isHebrew ? 'מקבל התאמה לפי מאמץ והתאוששות' : 'Gets sessions adjusted from effort and recovery',
    isHebrew ? 'מסיים 21 ימים עם בסיס חזק להמשך' : 'Finishes 21 days with a strong base for what is next',
  ];
  const credibilityPills = [
    isHebrew ? 'No fake counters' : 'No fake counters',
    isHebrew ? 'Adaptive coaching after each run' : 'Adaptive coaching after each run',
    isHebrew ? 'Phone-only friendly' : 'Phone-only friendly',
  ];
  const designTokens = {
    '--challenge-bg': '#07090d',
    '--challenge-surface': 'rgba(255,255,255,0.024)',
    '--challenge-surface-strong': 'rgba(255,255,255,0.04)',
    '--challenge-border': 'rgba(255,255,255,0.09)',
    '--challenge-muted': 'rgba(255,255,255,0.62)',
    '--challenge-soft': 'rgba(255,255,255,0.36)',
    '--challenge-accent': theme.glowColor,
  } as React.CSSProperties;
  const socialProofHeadline = isHebrew ? 'מי האתגר הזה משרת' : 'Who This Challenge Serves';
  const socialProofSubline = isHebrew
    ? 'פרופילים טיפוסיים שהאתגר מותאם אליהם. לא ביקורות, לא ספירת משתמשים.'
    : 'Typical runner profiles this challenge is built for. No fabricated testimonials and no made-up user counts.';
  const socialProofDisclaimer = isHebrew
    ? 'These are representative profiles, not verified reviews or usage stats.'
    : 'These are representative profiles, not verified reviews or usage stats.';

  const handleJoin = (location: string = 'hero') => {
    try {
      localStorage.setItem('preselectedChallenge', displayTemplate.slug);
      localStorage.setItem('beta_signup_complete', 'true');
    } catch { /* ignore */ }
    void trackAnalyticsEvent('challenge_landing_cta', { slug: displayTemplate.slug, language, button_location: location });
    router.push('/onboarding');
  };

  const handleEmailCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      localStorage.setItem('capture_email', email.trim());
      localStorage.setItem('preselectedChallenge', displayTemplate.slug);
      localStorage.setItem('beta_signup_complete', 'true');
    } catch { /* ignore */ }
    void trackAnalyticsEvent('email_capture_attempted', { slug: displayTemplate.slug, language });
    router.push('/onboarding');
  };

  const toggleFaq = (index: number) => {
    const isOpening = openFaqIndex !== index;
    setOpenFaqIndex(isOpening ? index : null);
    if (isOpening) {
      void trackAnalyticsEvent('faq_expanded', { slug: displayTemplate.slug, question_index: index, language });
    }
  };

  const handleProgressionClick = (toSlug: string) => {
    void trackAnalyticsEvent('challenge_progression_clicked', { from_slug: displayTemplate.slug, to_slug: toSlug, language });
    router.push(`/challenges/${toSlug}?lang=${language}`);
  };

  const stepColors = {
    emerald: { accent: 'text-emerald-400', accentBg: 'bg-emerald-400', border: 'border-emerald-400/40', ring: 'ring-emerald-400/30' },
    violet:  { accent: 'text-violet-400',  accentBg: 'bg-violet-400',  border: 'border-violet-400/40',  ring: 'ring-violet-400/30'  },
    orange:  { accent: 'text-orange-400',  accentBg: 'bg-orange-400',  border: 'border-orange-400/40',  ring: 'ring-orange-400/30'  },
  } as const;

  return (
    <div
      className={`min-h-screen bg-[var(--challenge-bg)] text-white selection:bg-white/20 ${isHebrew ? 'font-hebrew' : ''}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={isHebrew ? 'he' : 'en'}
      style={designTokens}
    >

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[color:rgba(7,9,13,0.88)] backdrop-blur-2xl border-b border-[color:var(--challenge-border)]">
        <div className={`max-w-7xl mx-auto px-5 h-14 flex items-center ${isHebrew ? 'flex-row-reverse' : ''} justify-between`}>
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBg} ring-4 ${theme.ring ?? 'ring-white/10'}`} />
            <span className="text-sm font-black tracking-[0.25em] uppercase text-white/80 group-hover:text-white transition-colors">
              RunSmart
            </span>
          </Link>
          <div className={`flex items-center gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <LanguageSwitcher language={language} onChange={setLanguagePreference} variant="dark" className="text-xs" />
            <button
              onClick={() => handleJoin('nav')}
              className={`h-8 px-4 rounded-full text-xs font-bold tracking-wider uppercase ${theme.accentBg} text-black hover:opacity-85 active:scale-95 transition-all`}
            >
              {copy.joinFree}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden pt-14">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 12% 15%, color-mix(in srgb, var(--challenge-accent) 26%, transparent) 0%, transparent 45%), radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--challenge-accent) 20%, transparent) 0%, transparent 42%)',
          }}
        />

        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(0,0,0,0)_0%,rgba(8,8,8,0.8)_100%)]" />

        {/* Animated pace line — sweeps in on load */}
        <motion.div
          className={`absolute top-[40%] left-0 h-px ${theme.accentBg} opacity-15`}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />

        {/* Ghost "21" */}
        <div className={`absolute top-1/2 ${isHebrew ? 'left-0 -translate-x-1/4' : 'right-0 translate-x-1/4'} -translate-y-1/2 pointer-events-none select-none`}>
          <motion.span
            className={`text-[18rem] md:text-[28rem] font-black ${theme.accent} leading-none tracking-tighter`}
            style={{ opacity: 0.03 }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 0.03, scale: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.1 }}
          >
            21
          </motion.span>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 pb-20 md:pb-28 w-full">

          {/* Badges row */}
          <motion.div
            className={`flex items-center gap-2 mb-10 flex-wrap ${isHebrew ? 'flex-row-reverse' : ''}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${theme.accentBorder} bg-white/[0.03] text-xs font-semibold tracking-[0.15em] uppercase ${theme.accent}`}>
              <CategoryIcon className="w-3 h-3" />
              {themeLabel}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold tracking-[0.15em] uppercase text-white/50">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < difficulty.dots ? theme.accentBg : 'bg-white/15'}`} />
              ))}
              {difficultyLabel}
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[10rem] font-black leading-[0.84] tracking-[-0.02em] mb-7 max-w-5xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            {displayTemplate.name.split(' ').map((word, i) => (
              <span key={i} className="block">
                {word === '21-Day' || word === '21' || word === 'יום' ? (
                  <span className={theme.accent}>{word}</span>
                ) : word}
              </span>
            ))}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="text-lg md:text-xl text-white/45 max-w-lg mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            {displayTemplate.tagline}
          </motion.p>

          {/* CTA block */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <button
              onClick={() => handleJoin('hero')}
              className={`group inline-flex items-center gap-3 h-14 px-8 rounded-full text-base font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_40px_-10px] ${theme.glow} border-0 mb-4`}
            >
              {copy.startChallenge}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Honest early access note */}
            <div className={`flex items-center gap-2 text-white/30 text-xs ${isHebrew ? 'flex-row-reverse' : ''}`}>
              <Sparkles className={`w-3 h-3 ${theme.accent} opacity-70`} />
              <span>{copy.earlyAccessBadge}</span>
            </div>
            <div className={`mt-6 flex flex-wrap gap-2.5 ${isHebrew ? 'justify-end' : ''}`}>
              {credibilityPills.map((pill) => (
                <div
                  key={pill}
                  className="inline-flex items-center rounded-full border border-[color:var(--challenge-border)] bg-[var(--challenge-surface)] px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[color:var(--challenge-muted)]"
                >
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${theme.accentBg}`} />
                  {pill}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </section>

      {/* ── PROMISE STRIP ── */}
      <section className="border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-5 py-14 md:py-20">
          <motion.div
            className={`flex items-start gap-5 ${isHebrew ? 'flex-row-reverse' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={`w-0.5 self-stretch rounded-full ${theme.accentBg} opacity-50 shrink-0`} />
            <blockquote className={`text-2xl md:text-4xl font-bold leading-snug tracking-tight ${theme.accent}`}>
              &ldquo;{displayTemplate.promise}&rdquo;
            </blockquote>
          </motion.div>
        </div>
      </section>

      {/* ── STATS BAR — honest values ── */}
      <section className="border-b border-[color:var(--challenge-border)] bg-[var(--challenge-surface)]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 py-3 md:py-4">
            {[
              { value: `${displayTemplate.durationDays}`, unit: copy.statDays, icon: Calendar },
              { value: difficultyLabel, unit: copy.statLevel, icon: Target },
              { value: formatCoachTone(displayTemplate.coachTone), unit: copy.statCoach, icon: Heart },
              { value: copy.statFreeValue, unit: copy.statFree, icon: Sparkles },
            ].map((stat) => (
              <div
                key={stat.unit}
                className="relative rounded-2xl border border-[color:var(--challenge-border)] bg-[var(--challenge-surface-strong)] py-7 md:py-8 px-4 md:px-6 text-center overflow-hidden"
              >
                <div className={`absolute left-0 right-0 top-0 h-px ${theme.accentBg} opacity-25`} />
                <stat.icon className={`w-4 h-4 mx-auto mb-3 ${theme.accent} opacity-70`} />
                <div className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">{stat.value}</div>
                <div className="text-[10px] font-semibold tracking-[0.2em] text-[color:var(--challenge-soft)] uppercase">{stat.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7-DAY JOURNEY — timeline style ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className={`flex items-end ${isHebrew ? 'flex-row-reverse' : ''} justify-between mb-14`}>
            <div>
              <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-3`}>{copy.yourJourney}</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">{copy.first7Days}</h2>
            </div>
            <p className="text-xs text-white/25 hidden md:block">{copy.moreDays}</p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical connector — desktop only */}
            <div className={`absolute top-0 bottom-0 ${isHebrew ? 'right-4' : 'left-4'} w-px bg-white/[0.04] hidden lg:block`} />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5"
            >
              {previewThemes.map((themeText, index) => {
                const dayLabel = themeText.split(':')[0] ?? `Day ${index + 1}`;
                const dayContent = themeText.includes(':')
                  ? themeText.substring(themeText.indexOf(':') + 1).trim()
                  : themeText;

                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    className={`group relative rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 overflow-hidden`}
                  >
                    {/* Accent top edge on hover */}
                    <div className={`absolute top-0 left-0 right-0 h-px ${theme.accentBg} opacity-0 group-hover:opacity-40 transition-opacity duration-300`} />

                    {/* Ghost day number */}
                    <div className={`text-5xl font-black ${theme.accent} opacity-[0.07] absolute top-2 right-3 leading-none select-none`}>
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className={`text-[9px] font-bold tracking-[0.2em] uppercase ${theme.accent} mb-2.5 opacity-70`}>
                      {dayLabel}
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed group-hover:text-white/75 transition-colors">
                      {dayContent}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <p className="text-xs text-white/25 mt-5 md:hidden">{copy.moreDaysShort}</p>
        </div>
      </section>

      {/* ── WHAT YOU'LL DO + COACH STYLE ── */}
      <section className="border-t border-white/[0.04] py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Timer, title: copy.whatYoullDo, body: displayTemplate.workoutPattern, hint: null },
              {
                icon: Heart,
                title: copy.yourAiCoach,
                body: null,
                hint: `${formatCoachTone(displayTemplate.coachTone)} ${copy.coachingStyleDesc}`,
              },
            ].map((card) => (
              <div key={card.title} className="relative rounded-3xl border border-white/[0.04] bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all duration-300">
                <div className={`absolute top-0 left-0 right-0 h-px ${theme.accentBg} opacity-30`} />
                <div className={`flex items-center gap-3 mb-6 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${theme.accent}`} />
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-white/80">{card.title}</h3>
                </div>
                <p className="text-sm text-white/45 leading-relaxed group-hover:text-white/60 transition-colors">
                  {card.body ?? (
                    <>
                      <span className={`font-semibold text-white/70`}>{formatCoachTone(displayTemplate.coachTone)}</span>
                      {' '}{copy.coachingStyleDesc}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ── */}
      <section className="border-t border-white/[0.04] py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-5">
          <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-4`}>{copy.builtFor}</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-5 max-w-3xl capitalize">
            {displayTemplate.targetAudience}
          </h2>
          <p className="text-lg text-white/35 max-w-2xl leading-relaxed">{displayTemplate.description}</p>
        </div>
      </section>

      {/* ── WHY IT WORKS ── */}
      <section className="border-t border-white/[0.04] py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16">
            <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-3`}>{copy.theMethod}</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">{copy.whyItWorks}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Target,
                title: isHebrew ? '21 ימים זה רק ההתחלה' : '21 Days Is\nJust the Start',
                desc: isHebrew
                  ? 'מחקרי יצירת הרגלים מראים שאוטומטיות מגיעה לאחר 66 ימים — 21 ימים בונים את הבסיס. ערכות יומיות מסירות את המכשול הגדול ביותר: ההחלטה מה לעשות.'
                  : 'Habit research shows 66 days to automatic — 21 builds the foundation. Daily themes remove the biggest barrier: deciding what to do.',
              },
              {
                icon: TrendingUp,
                title: isHebrew ? 'מאמן שמבין אותך' : 'Coaching That\nReads the Room',
                desc: isHebrew
                  ? 'אחרי כל ריצה, המאמן ה-AI קורא את דירוג המאמץ והמצב שלך ומתאים את מחר. ההבדל בין תוכנית למאמן.'
                  : 'After every run, your AI coach reads your effort and mood rating. It adjusts tomorrow before you even think about it.',
              },
              {
                icon: Users,
                title: isHebrew ? 'עובד עם מה שיש לך' : 'Works With\nWhat You Have',
                desc: isHebrew
                  ? 'GPS של טלפון. ללא שעון נדרש. 40% מהרצים לא משתמשים בשעוני ספורט — RunSmart נבנה עבורך. אם יש לך גארמין, הוא מסנכרן אוטומטית.'
                  : 'Phone GPS. No watch required. RunSmart is built to work great with just your phone.',
              },
            ].map((card) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="group relative rounded-3xl border border-white/[0.04] bg-white/[0.02] p-8 md:p-10 hover:border-white/10 hover:bg-white/[0.035] transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-6`}>
                  <card.icon className={`w-4 h-4 ${theme.accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight mb-4 whitespace-pre-line leading-tight">{card.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed group-hover:text-white/55 transition-colors">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF (TRUTHFUL) */}
      <section ref={experienceRef} className="border-t border-[color:var(--challenge-border)] py-20 md:py-28 bg-[var(--challenge-surface)]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="mb-14">
            <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-3`}>{copy.experienceLabel}</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">{socialProofHeadline}</h2>
            <p className={`text-[color:var(--challenge-soft)] max-w-2xl leading-relaxed ${isHebrew ? 'text-right' : ''}`}>{socialProofSubline}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stories.slice(0, 3).map((story, i) => (
              <motion.div
                key={`${story.persona}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                className="relative rounded-3xl border border-[color:var(--challenge-border)] bg-[var(--challenge-surface-strong)] p-7 md:p-8 overflow-hidden"
              >
                <div className={`absolute left-0 right-0 top-0 h-px ${theme.accentBg} opacity-30`} />
                <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.accent} mb-4`}>
                  {`Profile ${i + 1}`}
                </p>
                <h3 className={`text-lg font-bold text-white/85 leading-tight mb-4 ${isHebrew ? 'text-right' : ''}`}>
                  {story.persona}
                </h3>
                <p className={`text-sm text-[color:var(--challenge-soft)] leading-relaxed ${isHebrew ? 'text-right' : ''}`}>
                  {profileFocus[i] ?? profileFocus[profileFocus.length - 1]}
                </p>
              </motion.div>
            ))}
          </div>

          <p className={`text-[10px] text-white/25 mt-6 ${isHebrew ? 'text-right' : ''}`}>
            {socialProofDisclaimer}
          </p>
        </div>
      </section>

      {/* ── CHALLENGE PROGRESSION — with step connectors ── */}
      <section className="border-t border-white/[0.04] py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="mb-12">
            <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-3`}>{copy.progressionLabel}</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">{copy.progressionHeadline}</h2>
            <p className="text-white/35 max-w-lg">{copy.progressionSubline}</p>
          </div>

          <div className={`relative grid grid-cols-1 md:grid-cols-3 gap-3 ${isHebrew ? 'md:grid-flow-col-dense' : ''}`}>
            {PROGRESSION.map((step, idx) => {
              const isCurrent = step.slug === displayTemplate.slug;
              const sc = stepColors[step.color];

              return (
                <div key={step.slug} className="relative">
                  {/* Connector arrow between steps (not after last) */}
                  {idx < PROGRESSION.length - 1 && (
                    <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 ${isHebrew ? 'left-0 -translate-x-1/2 rotate-180' : 'right-0 translate-x-1/2'} z-10 items-center justify-center w-6 h-6`}>
                      <ChevronRight className="w-4 h-4 text-white/15" />
                    </div>
                  )}

                  <button
                    onClick={() => !isCurrent && handleProgressionClick(step.slug)}
                    disabled={isCurrent}
                    className={`relative w-full text-left rounded-2xl border p-6 transition-all duration-300 ${
                      isCurrent
                        ? `${sc.border} bg-white/[0.04] cursor-default ring-1 ${sc.ring}`
                        : 'border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/10 cursor-pointer'
                    }`}
                  >
                    {/* Step number */}
                    <div className={`text-[9px] font-bold tracking-[0.2em] uppercase mb-3 ${isCurrent ? sc.accent : 'text-white/25'}`}>
                      {isHebrew ? `שלב ${step.step}` : `Step ${step.step}`}
                    </div>

                    <div className="text-sm font-bold text-white/80 mb-1">
                      {isHebrew ? step.heLabel : step.enLabel}
                    </div>
                    <div className="text-xs text-white/35">
                      {isHebrew ? step.heSub : step.enSub}
                    </div>

                    {isCurrent ? (
                      <div className={`flex items-center gap-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider ${sc.accent}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.accentBg} animate-pulse`} />
                        {isHebrew ? 'כאן אתה עכשיו' : 'You are here'}
                      </div>
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 text-white/20 mt-4`} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ — open editorial style ── */}
      <section className="border-t border-white/[0.04] py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto px-5">
          <div className="mb-14">
            <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-3`}>{copy.faqLabel}</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">{copy.faqHeadline}</h2>
          </div>

          <div className="space-y-0">
            {faqSet.map((item, i) => (
              <div key={i} className="border-b border-white/[0.06] last:border-b-0">
                <button
                  className={`w-full py-6 flex items-start justify-between gap-6 text-left group ${isHebrew ? 'flex-row-reverse' : ''}`}
                  onClick={() => toggleFaq(i)}
                >
                  <span className={`text-sm font-semibold text-white/70 group-hover:text-white/90 transition-colors leading-relaxed ${isHebrew ? 'text-right' : ''}`}>
                    {item.q}
                  </span>
                  <div className={`shrink-0 w-5 h-5 rounded-full border border-white/10 flex items-center justify-center transition-colors mt-0.5 ${openFaqIndex === i ? `${theme.accentBg} border-transparent` : 'bg-transparent'}`}>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${openFaqIndex === i ? 'rotate-180 text-black' : 'text-white/40'}`}
                    />
                  </div>
                </button>
                <AnimatePresence>
                  {openFaqIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className={`pb-6 text-sm text-white/40 leading-relaxed ${isHebrew ? 'text-right' : ''}`}>
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative border-t border-white/[0.04] overflow-hidden">
        {/* Glow from below */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[120px] opacity-[0.06]"
          style={{ background: theme.glowColor }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />

        <div className="relative max-w-2xl mx-auto px-5 py-24 md:py-32 text-center">
          <p className={`text-[10px] font-bold tracking-[0.25em] uppercase ${theme.accent} mb-5`}>{copy.freeEarlyAccess}</p>

          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-5 leading-[0.88]">
            {copy.readyToStart}<br />
            <span className={theme.accent}>{copy.day1}</span>
          </h2>

          <p className="text-white/35 max-w-sm mx-auto mb-10 leading-relaxed text-sm">
            {copy.earlyAdopterNote}
          </p>

          {/* Email capture form */}
          <form
            onSubmit={handleEmailCapture}
            className={`flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto mb-5 ${isHebrew ? 'sm:flex-row-reverse' : ''}`}
          >
            <div className="relative flex-1">
              <Mail className={`absolute top-1/2 -translate-y-1/2 ${isHebrew ? 'right-4' : 'left-4'} w-4 h-4 text-white/25 pointer-events-none`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.emailPlaceholder}
                className={`w-full h-13 ${isHebrew ? 'pr-11 pl-4' : 'pl-11 pr-4'} rounded-full bg-white/[0.04] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all`}
                style={{ height: '52px' }}
              />
            </div>
            <button
              type="submit"
              className={`h-[52px] px-7 rounded-full text-sm font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_32px_-8px] ${theme.glow} shrink-0`}
            >
              {copy.emailCta}
            </button>
          </form>

          <p className="text-[11px] text-white/20 mb-6">{copy.emailDisclaimer}</p>

          {/* Or divider */}
          <div className={`flex items-center gap-4 max-w-sm mx-auto mb-5 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-white/20 uppercase tracking-wider">{isHebrew ? 'או' : 'or'}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <button
            onClick={() => handleJoin('final_cta')}
            className="inline-flex items-center gap-2 h-11 px-7 rounded-full text-sm font-semibold border border-white/10 text-white/50 hover:bg-white/[0.04] hover:text-white/80 hover:border-white/20 transition-all"
          >
            {isHebrew ? 'פשוט התחל עכשיו' : 'Just start now'}
            <ChevronRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-white/20 mt-5">{copy.noCreditCard}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-5 py-7 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className={`flex items-center gap-2.5 text-sm text-white/25 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`} />
            <span className="font-bold tracking-[0.15em] text-white/40">RunSmart</span>
            <span className="text-white/20">AI Running Coach</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-white/20">
            <Link href="/privacy" className="hover:text-white/45 transition-colors">{copy.privacy}</Link>
            <Link href="/terms" className="hover:text-white/45 transition-colors">{copy.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
