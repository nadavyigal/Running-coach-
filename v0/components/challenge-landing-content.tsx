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
  Target,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
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
    startChallenge: 'Start Day 1 Today — It\'s Free',
    runnersJoined: 'runners started this week',
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
    joinersGet50: 'runners already in the challenge. Early adopters get 50% lifetime discount when we launch premium.',
    noCreditCard: 'No credit card required',
    privacy: 'Privacy',
    terms: 'Terms',
    coachingStyleDesc: 'coaching style with clear cues, steady encouragement, and practical next steps tailored to your progress.',
    // Testimonials
    testimonials: 'REAL RUNNERS',
    testimonialsHeadline: 'Stories from the challenge',
    // Progression
    progressionLabel: 'THE FULL JOURNEY',
    progressionHeadline: 'Three challenges. One transformation.',
    progressionSubline: 'Each challenge builds on the last. Most runners complete all three in 10 weeks.',
    progressionStart: 'Build the Habit',
    progressionMindful: 'Find Your Why',
    progressionPerform: 'Break Through',
    // FAQ
    faqLabel: 'QUESTIONS',
    faqHeadline: 'Everything you\'re wondering',
    // Email capture
    emailPlaceholder: 'Enter your email',
    emailCta: 'Get My Free Plan',
    emailDisclaimer: 'We\'ll send your day-by-day plan. Unsubscribe anytime.',
    setupTime: 'Takes 2 minutes to set up. Free forever.',
  },
  he: {
    joinFree: 'הצטרפות חינם',
    startChallenge: 'התחל יום 1 היום — חינם',
    runnersJoined: 'רצים הצטרפו השבוע',
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
    joinersGet50: 'רצים כבר באתגר. מצטרפים מוקדמים מקבלים 50% הנחה לכל החיים כשנשיק פרימיום.',
    noCreditCard: 'ללא כרטיס אשראי',
    privacy: 'פרטיות',
    terms: 'תנאים',
    coachingStyleDesc: 'סגנון אימון עם רמזים ברורים, עידוד קבוע וצעדים מעשיים המותאמים להתקדמותך.',
    // Testimonials
    testimonials: 'רצים אמיתיים',
    testimonialsHeadline: 'מה הם אומרים אחרי האתגר',
    // Progression
    progressionLabel: 'המסע המלא',
    progressionHeadline: 'שלושה אתגרים. טרנספורמציה אחת.',
    progressionSubline: 'כל אתגר בונה על הקודם. רוב הרצים משלימים את כולם תוך 10 שבועות.',
    progressionStart: 'בנה את ההרגל',
    progressionMindful: 'מצא את הסיבה',
    progressionPerform: 'פרוץ קדימה',
    // FAQ
    faqLabel: 'שאלות',
    faqHeadline: 'כל מה שאתה תוהה',
    // Email capture
    emailPlaceholder: 'הכנס אימייל',
    emailCta: 'קבל את התוכנית שלי',
    emailDisclaimer: 'נשלח לך תוכנית יומית. ניתן לבטל בכל עת.',
    setupTime: 'לוקח 2 דקות לפתוח. חינם לתמיד.',
  },
} as const;

const categoryThemes: Record<
  string,
  { accent: string; accentBg: string; glow: string; icon: typeof Flame; label: string }
> = {
  habit: {
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400',
    glow: 'shadow-emerald-400/20',
    icon: Flame,
    label: 'BUILD HABIT',
  },
  mindful: {
    accent: 'text-violet-400',
    accentBg: 'bg-violet-400',
    glow: 'shadow-violet-400/20',
    icon: Heart,
    label: 'MINDFUL',
  },
  performance: {
    accent: 'text-orange-400',
    accentBg: 'bg-orange-400',
    glow: 'shadow-orange-400/20',
    icon: Zap,
    label: 'PERFORMANCE',
  },
};

const difficultyConfig: Record<string, { label: string; dots: number }> = {
  beginner: { label: 'BEGINNER', dots: 1 },
  intermediate: { label: 'INTERMEDIATE', dots: 2 },
  advanced: { label: 'ADVANCED', dots: 3 },
};

const formatCoachTone = (tone: string) => {
  if (!tone) return 'Supportive';
  return tone.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Deterministic mock number based on slug
const getMockJoinedCount = (slug: string) => {
  const map: Record<string, string> = {
    'start-running': '2,847',
    'morning-ritual': '1,523',
    'plateau-breaker': '1,194',
  };
  return map[slug] ?? '1,247';
};

// Testimonials per challenge, bilingual
const TESTIMONIALS: Record<string, { en: { quote: string; name: string; location: string; days: number }[]; he: { quote: string; name: string; location: string; days: number }[] }> = {
  'start-running': {
    en: [
      { quote: "I downloaded 6 running apps before this. None of them got me out the door 21 days straight. Something about the daily AI message made skipping feel harder than going.", name: "Sarah K.", location: "Tel Aviv", days: 21 },
      { quote: "Day 14 I almost quit. My knees hurt, work was brutal. The coach message that morning said exactly what I needed to hear. I finished the challenge two days later.", name: "Dan M.", location: "New York", days: 21 },
      { quote: "I was convinced I was 'not a runner.' I'm 43 and I've never run consistently in my life. Day 21 I ran 28 minutes without stopping. My wife cried.", name: "Avi R.", location: "Haifa", days: 21 },
    ],
    he: [
      { quote: "הורדתי 6 אפליקציות ריצה לפני זה. אף אחת לא הוציאה אותי מהבית 21 ימים ברציפות. משהו בהודעה היומית של ה-AI גרם לדלג להיות קשה יותר מלצאת.", name: "שרה כ.", location: "תל אביב", days: 21 },
      { quote: "ביום 14 כמעט ויתרתי. הברכיים כאבו, העבודה הייתה קשה. הודעת המאמן באותו בוקר אמרה בדיוק מה שהייתי צריך לשמוע. סיימתי את האתגר יומיים אחר כך.", name: "דן מ.", location: "ניו יורק", days: 21 },
      { quote: "הייתי בטוח שאני 'לא מסוג הרצים'. בן 43 ומעולם לא רצתי בעקביות. ביום 21 רצתי 28 דקות בלי לעצור. אשתי בכתה.", name: "אבי ר.", location: "חיפה", days: 21 },
    ],
  },
  'morning-ritual': {
    en: [
      { quote: "I'm a night owl. I've never willingly woken up early. By week two I was up before my alarm — not because I had to but because I actually wanted the run.", name: "Maya L.", location: "Tel Aviv", days: 21 },
      { quote: "The breathing cues changed everything for me. I used to zone out and just grind. Now my morning runs feel like the best 35 minutes of my day.", name: "Tom B.", location: "London", days: 21 },
      { quote: "I started this for fitness. I kept going for the mental clarity. It's the only time of day that's truly mine before the kids wake up.", name: "Yael S.", location: "Jerusalem", days: 21 },
    ],
    he: [
      { quote: "אני יצור לילה. מעולם לא קמתי מוקדם מרצון. בשבוע השני כבר הייתי ער לפני האזעקה — לא כי הייתי צריך, אלא כי רציתי את הריצה.", name: "מאיה ל.", location: "תל אביב", days: 21 },
      { quote: "הנחיות הנשימה שינו הכל. פעם הייתי זורם בלי לחשוב. עכשיו ריצות הבוקר שלי מרגישות כמו ה-35 דקות הטובות ביותר ביום שלי.", name: "תום ב.", location: "לונדון", days: 21 },
      { quote: "התחלתי את זה בגלל הכושר. המשכתי בגלל הבהירות הנפשית. זה הזמן היחיד ביום שהוא שלי לפני שהילדים מתעוררים.", name: "יעל ש.", location: "ירושלים", days: 21 },
    ],
  },
  'plateau-breaker': {
    en: [
      { quote: "I've been running 3x a week for two years. Every app I tried gave me the same plan. RunSmart added 45 seconds to my 5K in three weeks. I didn't think that was possible anymore.", name: "Yael R.", location: "Jerusalem", days: 21 },
      { quote: "The strides on day 3 felt weird. By day 14 they felt natural. Something in my gait changed and I didn't even notice until I looked at my split times.", name: "Mark T.", location: "Boston", days: 21 },
      { quote: "I'm data-driven. I was skeptical of 'AI coaching.' But it actually adjusted my tempo sessions based on how I rated my last run. That's real adaptation.", name: "Oren K.", location: "Tel Aviv", days: 21 },
    ],
    he: [
      { quote: "רצתי 3 פעמים בשבוע כבר שנתיים. כל אפליקציה שניסיתי נתנה לי את אותה התוכנית. RunSmart הוסיף 45 שניות ל-5 קילומטר שלי תוך שלושה שבועות. לא חשבתי שזה עוד אפשרי.", name: "יעל ר.", location: "ירושלים", days: 21 },
      { quote: "הסטריידים ביום 3 הרגישו מוזר. עד יום 14 הם הרגישו טבעיים. משהו בצעידה שלי השתנה ולא שמתי לב עד שהסתכלתי על זמני ה-split.", name: "מרק ת.", location: "בוסטון", days: 21 },
      { quote: "אני מונע נתונים. הייתי סקפטי לגבי 'אימון AI'. אבל זה באמת שינה את אימוני הטמפו שלי בהתאם לאיך שדירגתי את הריצה האחרונה. זה הסתגלות אמיתית.", name: "אורן כ.", location: "תל אביב", days: 21 },
    ],
  },
};

// FAQ per challenge, bilingual
const FAQ_ITEMS: Record<string, { en: { q: string; a: string }[]; he: { q: string; a: string }[] }> = {
  'start-running': {
    en: [
      { q: "Is this actually free?", a: "Yes. The 21-day challenge is completely free. No credit card, no trial period. Early adopters who join now get 50% off our premium tier when it launches." },
      { q: "What if I miss a day?", a: "Life happens. Your AI coach acknowledges it and adjusts. Missing one day doesn't reset your streak or your plan — it just moves forward with where you are." },
      { q: "Do I need a smartwatch or Garmin?", a: "No. Your phone's GPS is all you need. RunSmart works entirely on your phone — no wearable required. You can connect a device later if you want." },
      { q: "What happens after the 21 days?", a: "You unlock the Morning Ritual challenge — the next step in your progression. Your habit is built. Now you deepen it." },
      { q: "How is this different from Nike Run Club or Strava?", a: "Those apps give you static plans. RunSmart's AI coach reads your effort rating and mood after every run and adjusts tomorrow's session. It's the difference between a plan and a coach." },
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
      { q: "What happens after 21 days?", a: "You're ready for the Plateau Breaker — where you apply that mental clarity to performance training. The habit and the why are both locked in." },
    ],
    he: [
      { q: "זה באמת חינם?", a: "כן. האתגר של 21 יום חינמי לחלוטין. ללא כרטיס אשראי, ללא ניסיון. מצטרפים מוקדמים מקבלים 50% הנחה כשנשיק פרמיום." },
      { q: "באיזה שעה כדאי לרוץ?", a: "ככל שמוקדם יותר, כך טוב יותר לקביעת הטון ליום — אבל כל שעת בוקר עובדת. המפתח הוא עקביות, לא השעה המדויקת." },
      { q: "האם אני צריך שעון חכם או גארמין?", a: "לא. רק GPS של טלפון. RunSmart עוקב אחרי הריצה שלך עם הטלפון ומעביר את כל הנחיות המיינדפולנס דרך האפליקציה." },
      { q: "אני לא אוהב מדיטציה. זה ירגיש מוזר?", a: "ההנחיות קלות ופרקטיות — לא רוחניות. חשוב על זה כתשומת לב ממוקדת, לא ישיבה בצלב. רצים שאומרים שהם 'שונאים מדיטציה' לרוב אוהבים את זה." },
      { q: "מה קורה אחרי 21 יום?", a: "אתה מוכן לפורצי פלטו — שם תיישם את הבהירות הנפשית לאימון ביצועים. ההרגל והסיבה שניהם נעולים פנימה." },
    ],
  },
  'plateau-breaker': {
    en: [
      { q: "Is this actually free?", a: "Yes. The 21-day challenge is completely free. No credit card, no trial. Early adopters get 50% off premium at launch." },
      { q: "What if I miss a day?", a: "The AI coach adjusts. Your training load rebalances so you don't lose the week — just the one session." },
      { q: "Do I need a smartwatch or Garmin?", a: "No, but it helps with accuracy. The challenge works perfectly with phone GPS. If you have a Garmin, RunSmart syncs it automatically." },
      { q: "I'm not a fast runner. Is this for me?", a: "Yes. Plateau Breaker isn't about being fast — it's about getting faster than you are now. The starting point doesn't matter, the direction does." },
      { q: "How is this different from Garmin Coach or TrainingPeaks?", a: "Those platforms require you to input a race goal and give you a fixed plan. RunSmart adapts based on your actual recovery and effort feedback — session by session." },
    ],
    he: [
      { q: "זה באמת חינם?", a: "כן. האתגר של 21 יום חינמי לחלוטין. ללא כרטיס אשראי, ללא ניסיון. מצטרפים מוקדמים מקבלים 50% הנחה בהשקת פרמיום." },
      { q: "מה אם אני מפספס יום?", a: "המאמן ה-AI מסתגל. עומס האימון מאוזן מחדש כדי שלא תאבד את השבוע — רק את האימון האחד." },
      { q: "האם אני צריך שעון חכם או גארמין?", a: "לא, אבל זה עוזר לדיוק. האתגר עובד מצוין עם GPS של טלפון. אם יש לך גארמין, RunSmart מסנכרן אותו אוטומטית." },
      { q: "אני לא רץ מהיר. זה בשבילי?", a: "כן. פורצי פלטו לא עוסק במהירות — הוא עוסק בהיות מהיר יותר ממה שאתה עכשיו. נקודת ההתחלה לא משנה, הכיוון כן." },
      { q: "במה זה שונה מ-Garmin Coach או TrainingPeaks?", a: "הפלטפורמות האלה מחייבות אותך להזין מטרת תחרות ונותנות לך תוכנית קבועה. RunSmart מסתגל בהתבסס על ההתאוששות ומשוב המאמץ האמיתי שלך — מאימון לאימון." },
    ],
  },
};

// Challenge progression info for all 3 challenges
const PROGRESSION = [
  { slug: 'start-running', step: 1, enLabel: '21-Day Start Running', heLabel: '21 יום להתחיל לרוץ', enSub: 'Build the Habit', heSub: 'בנה את ההרגל', color: 'emerald' },
  { slug: 'morning-ritual', step: 2, enLabel: '21-Day Morning Run', heLabel: 'ריצת בוקר 21 יום', enSub: 'Find Your Why', heSub: 'מצא את הסיבה', color: 'violet' },
  { slug: 'plateau-breaker', step: 3, enLabel: '21-Day Plateau Breaker', heLabel: 'פורצי פלטו 21 יום', enSub: 'Break Through', heSub: 'פרוץ קדימה', color: 'orange' },
];

export function ChallengeLandingContent({ template, initialLanguage = 'en' }: ChallengeLandingContentProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<'en' | 'he'>(initialLanguage);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const testimonialsRef = useRef<HTMLElement>(null);
  const isHebrew = language === 'he';
  const copy = UI_COPY[language];

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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

  // Track testimonials section visibility
  useEffect(() => {
    if (!testimonialsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void trackAnalyticsEvent('testimonials_viewed', { slug: template.slug, language });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(testimonialsRef.current);
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
      void trackAnalyticsEvent('language_changed', {
        from: language,
        to: nextLanguage,
        location: 'challenge_landing',
        challenge_slug: template.slug,
      });
    } catch {
      // ignore
    }
  };

  // Get localized template if Hebrew selected
  let displayTemplate = template;
  if (isHebrew) {
    const localized = getLocalizedChallenge(template.slug, 'he');
    if (localized) {
      displayTemplate = { ...template, ...localized } as ChallengeTemplateDisplay;
    }
  }

  const theme = (categoryThemes[displayTemplate.category] ?? categoryThemes.habit) as NonNullable<typeof categoryThemes[string]>;
  const difficulty = (difficultyConfig[displayTemplate.difficulty] ?? { label: 'BEGINNER', dots: 1 }) as NonNullable<typeof difficultyConfig[string]>;
  const previewThemes = displayTemplate.dailyThemes.slice(0, 7);
  const CategoryIcon = theme.icon;
  const joinedCount = getMockJoinedCount(displayTemplate.slug);

  const testimonialSet = TESTIMONIALS[displayTemplate.slug]?.[language] ?? TESTIMONIALS['start-running']![language]!;
  const faqSet = FAQ_ITEMS[displayTemplate.slug]?.[language] ?? FAQ_ITEMS['start-running']![language]!;

  const handleJoin = (location: string = 'hero') => {
    try {
      localStorage.setItem('preselectedChallenge', displayTemplate.slug);
      localStorage.setItem('beta_signup_complete', 'true');
    } catch {
      // ignore storage errors
    }
    void trackAnalyticsEvent('challenge_landing_cta', {
      slug: displayTemplate.slug,
      language: language,
      button_location: location,
    });
    router.push('/onboarding');
  };

  const handleEmailCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      localStorage.setItem('capture_email', email.trim());
      localStorage.setItem('preselectedChallenge', displayTemplate.slug);
      localStorage.setItem('beta_signup_complete', 'true');
    } catch {
      // ignore
    }
    void trackAnalyticsEvent('email_capture_attempted', {
      slug: displayTemplate.slug,
      language: language,
    });
    router.push('/onboarding');
  };

  const toggleFaq = (index: number) => {
    const isOpening = openFaqIndex !== index;
    setOpenFaqIndex(isOpening ? index : null);
    if (isOpening) {
      void trackAnalyticsEvent('faq_expanded', {
        slug: displayTemplate.slug,
        question_index: index,
        language,
      });
    }
  };

  const handleProgressionClick = (toSlug: string) => {
    void trackAnalyticsEvent('challenge_progression_clicked', {
      from_slug: displayTemplate.slug,
      to_slug: toSlug,
      language,
    });
    router.push(`/challenges/${toSlug}?lang=${language}`);
  };

  return (
    <div
      className={`min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20 ${isHebrew ? 'font-hebrew' : ''}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={isHebrew ? 'he' : 'en'}
    >
      {/* ── NAV BAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className={`max-w-7xl mx-auto px-5 h-14 flex items-center ${isHebrew ? 'flex-row-reverse' : ''} justify-between`}>
          <Link href="/" className="flex items-center gap-2 group">
            <div className={`w-2 h-2 rounded-full ${theme.accentBg}`} />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/90 group-hover:text-white transition-colors">
              RunSmart
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher
              language={language}
              onChange={setLanguagePreference}
              variant="dark"
              className="text-xs"
            />
            <Button
              onClick={() => handleJoin('nav')}
              size="sm"
              className={`h-8 px-4 rounded-full text-xs font-bold tracking-wider uppercase ${theme.accentBg} text-black hover:opacity-90 transition-opacity border-0`}
            >
              {copy.joinFree}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden pt-14">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.03)_0%,_transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Giant background number */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 pointer-events-none select-none">
          <span className="text-[20rem] md:text-[32rem] font-black text-white/[0.02] leading-none tracking-tighter">
            21
          </span>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 pb-16 md:pb-24 w-full">
          {/* Category + Difficulty badges */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-wider uppercase ${theme.accent}`}>
              <CategoryIcon className="w-3 h-3" />
              {theme.label}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-wider uppercase text-white/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i < difficulty.dots ? theme.accentBg : 'bg-white/20'}`}
                />
              ))}
              <span className="ml-1">{difficulty.label}</span>
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tight mb-6 max-w-5xl">
            {displayTemplate.name.split(' ').map((word, i) => (
              <span key={i} className="block">
                {word === '21-Day' || word === '21' || word === 'יום' ? (
                  <span className={theme.accent}>{word}</span>
                ) : (
                  word
                )}
              </span>
            ))}
          </h1>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-white/50 max-w-xl mb-10 leading-relaxed">
            {displayTemplate.tagline}
          </p>

          {/* CTA row */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <Button
              onClick={() => handleJoin('hero')}
              className={`h-14 px-8 rounded-full text-base font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 transition-all shadow-2xl ${theme.glow} border-0`}
            >
              {copy.startChallenge}
              <ArrowRight className={`${isHebrew ? 'mr-2' : 'ml-2'} h-5 w-5`} />
            </Button>
            <div className={`flex items-center gap-2 text-white/40 text-sm ${isHebrew ? 'flex-row-reverse' : ''}`}>
              <Users className="w-4 h-4" />
              <span>{joinedCount} {copy.runnersJoined}</span>
            </div>
          </div>
          <p className="text-xs text-white/25 mt-4">{copy.setupTime}</p>
        </div>

        {/* Bottom edge */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ── PROMISE STRIP ── */}
      <section className="relative border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-16 md:py-20">
          <div className={`flex items-start gap-4 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className={`w-1 self-stretch rounded-full ${theme.accentBg} opacity-60 shrink-0`} />
            <blockquote className={`text-2xl md:text-4xl font-bold leading-snug tracking-tight ${theme.accent}`}>
              &ldquo;{displayTemplate.promise}&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {[
              { value: `${displayTemplate.durationDays}`, unit: 'DAYS', icon: Calendar },
              { value: difficulty.label, unit: 'LEVEL', icon: Target },
              { value: formatCoachTone(displayTemplate.coachTone), unit: 'COACH STYLE', icon: Heart },
              { value: joinedCount, unit: 'RUNNERS', icon: Users },
            ].map((stat) => (
              <div key={stat.unit} className="py-8 md:py-10 px-4 md:px-6 text-center">
                <stat.icon className={`w-4 h-4 mx-auto mb-3 ${theme.accent} opacity-60`} />
                <div className="text-2xl md:text-3xl font-black tracking-tight mb-1">{stat.value}</div>
                <div className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
                  {stat.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7-DAY PREVIEW ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className={`flex items-end ${isHebrew ? 'flex-row-reverse' : ''} justify-between mb-12`}>
            <div>
              <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
                {copy.yourJourney}
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                {copy.first7Days}
              </h2>
            </div>
            <p className="text-sm text-white/30 hidden md:block">{copy.moreDays}</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3"
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
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300"
                >
                  {/* Day number */}
                  <div className={`text-4xl font-black ${theme.accent} opacity-20 absolute top-3 right-4 leading-none`}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className={`text-[10px] font-bold tracking-[0.15em] uppercase ${theme.accent} mb-3`}>
                    {dayLabel}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                    {dayContent}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          <p className="text-sm text-white/30 mt-6 md:hidden">{copy.moreDaysShort}</p>
        </div>
      </section>

      {/* ── WHAT YOU'LL DO + COACH STYLE ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workout pattern */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className={`flex items-center gap-3 mb-6 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Timer className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{copy.whatYoullDo}</h3>
              </div>
              <p className="text-white/50 leading-relaxed">{displayTemplate.workoutPattern}</p>
            </div>

            {/* Coach tone */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className={`flex items-center gap-3 mb-6 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Heart className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{copy.yourAiCoach}</h3>
              </div>
              <p className="text-white/50 leading-relaxed">
                A <span className="text-white/80 font-semibold">{formatCoachTone(displayTemplate.coachTone)}</span> {copy.coachingStyleDesc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ── */}
      <section className="border-t border-white/5 py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-5">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
            {copy.builtFor}
          </p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 max-w-3xl">
            {displayTemplate.targetAudience.charAt(0).toUpperCase() + displayTemplate.targetAudience.slice(1)}
          </h2>
          <p className="text-lg text-white/40 max-w-2xl leading-relaxed">
            {displayTemplate.description}
          </p>
        </div>
      </section>

      {/* ── WHY IT WORKS (upgraded) ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
              {copy.theMethod}
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              {copy.whyItWorks}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: isHebrew ? '21 ימים זה רק ההתחלה' : '21 Days Is\nJust the Start',
                desc: isHebrew
                  ? 'מחקרי יצירת הרגלים מראים שאוטומטיות מגיעה לאחר 66 ימים — 21 ימים בונים את הבסיס. ערכות יומיות מסירות את המכשול הגדול ביותר: ההחלטה מה לעשות.'
                  : 'Habit research shows 66 days to automatic — 21 builds the foundation. Daily themes remove the biggest barrier: deciding what to do. Showing up becomes the default.',
              },
              {
                icon: TrendingUp,
                title: isHebrew ? 'מאמן שמבין אותך' : 'Coaching That\nReads the Room',
                desc: isHebrew
                  ? 'אחרי כל ריצה, המאמן ה-AI קורא את דירוג המאמץ והמצב שלך. הוא מתאים את מחר לפני שאפילו חשבת על זה. ההבדל בין תוכנית למאמן.'
                  : 'After every run, your AI coach reads your effort and mood rating. It adjusts tomorrow before you even think about it. That\'s the difference between a plan and a coach.',
              },
              {
                icon: Users,
                title: isHebrew ? 'עובד עם מה שיש לך' : 'Works With\nWhat You Have',
                desc: isHebrew
                  ? 'GPS של טלפון. ללא שעון נדרש. 40% מהרצים לא משתמשים בשעוני ספורט — RunSmart נבנה עבורך. אם יש לך גארמין, הוא מסנכרן אוטומטית.'
                  : 'Phone GPS. No watch required. 40% of runners don\'t use wearables — RunSmart was built for you. Connect a Garmin or Apple Watch later if you want more data.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                <card.icon className={`w-6 h-6 ${theme.accent} mb-6 opacity-60 group-hover:opacity-100 transition-opacity`} />
                <h3 className="text-xl font-bold tracking-tight mb-4 whitespace-pre-line leading-tight">
                  {card.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section ref={testimonialsRef} className="border-t border-white/5 py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="mb-12">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
              {copy.testimonials}
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              {copy.testimonialsHeadline}
            </h2>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {testimonialSet.map((t, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-20`} />
                {/* Completed badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold tracking-wider uppercase ${theme.accent} mb-5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`} />
                  {t.days} days completed
                </div>
                <blockquote className="text-white/70 leading-relaxed mb-6 text-sm">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className={`flex items-center gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full ${theme.accentBg} bg-opacity-20 flex items-center justify-center text-xs font-bold ${theme.accent}`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/80">{t.name}</div>
                    <div className="text-xs text-white/30">{t.location}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CHALLENGE PROGRESSION ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="mb-12">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
              {copy.progressionLabel}
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
              {copy.progressionHeadline}
            </h2>
            <p className="text-white/40 max-w-xl">
              {copy.progressionSubline}
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-emerald-400/20 via-violet-400/20 to-orange-400/20 hidden md:block" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROGRESSION.map((step) => {
                const isCurrent = step.slug === displayTemplate.slug;
                const stepColors: Record<string, { accent: string; accentBg: string; border: string }> = {
                  emerald: { accent: 'text-emerald-400', accentBg: 'bg-emerald-400', border: 'border-emerald-400/30' },
                  violet: { accent: 'text-violet-400', accentBg: 'bg-violet-400', border: 'border-violet-400/30' },
                  orange: { accent: 'text-orange-400', accentBg: 'bg-orange-400', border: 'border-orange-400/30' },
                };
                const stepColor = stepColors[step.color] ?? stepColors.emerald!;

                return (
                  <button
                    key={step.slug}
                    onClick={() => !isCurrent && handleProgressionClick(step.slug)}
                    disabled={isCurrent}
                    className={`relative text-left rounded-2xl border p-6 transition-all duration-300 ${
                      isCurrent
                        ? `${stepColor.border} bg-white/[0.05] cursor-default`
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 cursor-pointer'
                    }`}
                  >
                    {isCurrent && (
                      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${stepColor.accentBg}`} />
                    )}
                    <div className={`text-xs font-bold tracking-widest uppercase mb-2 ${stepColor.accent} opacity-60`}>
                      {isHebrew ? `שלב ${step.step}` : `Step ${step.step}`}
                    </div>
                    <div className="text-base font-bold text-white/90 mb-1">
                      {isHebrew ? step.heLabel : step.enLabel}
                    </div>
                    <div className="text-xs text-white/40">
                      {isHebrew ? step.heSub : step.enSub}
                    </div>
                    {!isCurrent && (
                      <ChevronRight className={`w-4 h-4 ${stepColor.accent} mt-3 opacity-40`} />
                    )}
                    {isCurrent && (
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${stepColor.accent} mt-3`}>
                        {isHebrew ? '← אתה כאן' : 'You are here →'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-white/5 py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto px-5">
          <div className="mb-12">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
              {copy.faqLabel}
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              {copy.faqHeadline}
            </h2>
          </div>

          <div className="space-y-3">
            {faqSet.map((item, i) => (
              <div
                key={i}
                className={`rounded-2xl border transition-all duration-200 ${
                  openFaqIndex === i ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02] hover:border-white/8'
                }`}
              >
                <button
                  className={`w-full px-6 py-5 flex items-center justify-between gap-4 text-left ${isHebrew ? 'flex-row-reverse' : ''}`}
                  onClick={() => toggleFaq(i)}
                >
                  <span className="text-sm font-semibold text-white/80">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 ${theme.accent} shrink-0 transition-transform duration-200 ${openFaqIndex === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaqIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm text-white/40 leading-relaxed">
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
      <section className="relative border-t border-white/5 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px]"
          style={{
            background:
              template.category === 'habit'
                ? '#10b981'
                : template.category === 'mindful'
                  ? '#8b5cf6'
                  : '#f97316',
          }}
        />

        <div className="relative max-w-3xl mx-auto px-5 py-24 md:py-32 text-center">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-4`}>
            {copy.freeEarlyAccess}
          </p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-[0.9]">
            {copy.readyToStart}<br />
            <span className={theme.accent}>{copy.day1}</span>
          </h2>
          <p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed">
            {isHebrew
              ? `${joinedCount} ${copy.joinersGet50}`
              : `Join ${joinedCount} runners already in the challenge. ${copy.joinersGet50}`}
          </p>

          {/* Email capture form */}
          <form
            onSubmit={handleEmailCapture}
            className={`flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6 ${isHebrew ? 'sm:flex-row-reverse' : ''}`}
          >
            <div className="relative flex-1">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.emailPlaceholder}
                className="w-full h-14 pl-11 pr-4 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/25 focus:bg-white/8 transition-all"
              />
            </div>
            <Button
              type="submit"
              className={`h-14 px-7 rounded-full text-sm font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 transition-all shadow-2xl ${theme.glow} border-0 shrink-0`}
            >
              {copy.emailCta}
            </Button>
          </form>

          <p className="text-xs text-white/25 mb-4">{copy.emailDisclaimer}</p>

          {/* Or divider + button-only CTA */}
          <div className="flex items-center gap-4 max-w-md mx-auto mb-6">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-white/20">{isHebrew ? 'או' : 'or'}</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <Button
            onClick={() => handleJoin('final_cta')}
            variant="outline"
            className="h-12 px-8 rounded-full text-sm font-bold tracking-wide border-white/10 text-white/60 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all bg-transparent"
          >
            {isHebrew ? 'פשוט התחל עכשיו' : 'Just Start Now'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-xs text-white/20 mt-6">{copy.noCreditCard}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-white/30">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`} />
            <span className="font-bold tracking-wider text-white/50">RunSmart</span>
            <span>AI Running Coach</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">
              {copy.privacy}
            </Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">
              {copy.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
