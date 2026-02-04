/**
 * Challenge Prompts - Daily coaching prompts for challenges
 * Organized by challenge type and timing (before/after run)
 */

export interface ChallengePrompt {
  timing: 'before' | 'after';
  message: string;
  tone: 'gentle' | 'tough_love' | 'analytical' | 'calm';
}

// ============================================================================
// START RUNNING CHALLENGE (Gentle Tone)
// ============================================================================

export const START_RUNNING_PROMPTS_BEFORE: ChallengePrompt[] = [
  {
    timing: 'before',
    tone: 'gentle',
    message: 'Today is about showing up. That\'s all. Just lace up and step outside. You\'ve got this!',
  },
  {
    timing: 'before',
    tone: 'gentle',
    message: 'No pressure today. We\'re building a habit, not breaking records. Take it easy and enjoy.',
  },
  {
    timing: 'before',
    tone: 'gentle',
    message: 'Remember: walk breaks are part of the plan. They\'re not cheating, they\'re smart training.',
  },
  {
    timing: 'before',
    tone: 'gentle',
    message: 'Focus on time, not distance. If you\'re moving for the planned duration, you\'re winning.',
  },
  {
    timing: 'before',
    tone: 'gentle',
    message: 'Your body is learning. Be patient with yourself. Every step is progress.',
  },
];

export const START_RUNNING_PROMPTS_AFTER: ChallengePrompt[] = [
  {
    timing: 'after',
    tone: 'gentle',
    message: 'You did it! You showed up and that\'s what matters most. How do you feel?',
  },
  {
    timing: 'after',
    tone: 'gentle',
    message: 'Another day complete! Notice how your body feels. Running is becoming part of who you are.',
  },
  {
    timing: 'after',
    tone: 'gentle',
    message: 'Well done! Each run is building your foundation. Tomorrow will feel a little easier.',
  },
  {
    timing: 'after',
    tone: 'gentle',
    message: 'You\'re a runner now. Let that sink in. You just did what you set out to do.',
  },
  {
    timing: 'after',
    tone: 'gentle',
    message: 'Great work! Notice how you feel accomplished? That\'s the runner\'s high kicking in.',
  },
];

// ============================================================================
// MORNING RITUAL CHALLENGE (Calm Tone)
// ============================================================================

export const MORNING_RITUAL_PROMPTS_BEFORE: ChallengePrompt[] = [
  {
    timing: 'before',
    tone: 'calm',
    message: 'Before you start, take three deep breaths. Set your intention for today\'s run.',
  },
  {
    timing: 'before',
    tone: 'calm',
    message: 'This run is your moving meditation. Let go of yesterday, don\'t worry about tomorrow. Just be here.',
  },
  {
    timing: 'before',
    tone: 'calm',
    message: 'Notice how you feel right now. Bring that awareness into your run. No judgment, just observation.',
  },
  {
    timing: 'before',
    tone: 'calm',
    message: 'Your morning run is your gift to yourself. Approach it with gratitude, not obligation.',
  },
  {
    timing: 'before',
    tone: 'calm',
    message: 'Focus on your breath today. Let it anchor you when your mind wanders.',
  },
];

export const MORNING_RITUAL_PROMPTS_AFTER: ChallengePrompt[] = [
  {
    timing: 'after',
    tone: 'calm',
    message: 'Beautiful. Notice how you feel now versus before the run. This is why you do this.',
  },
  {
    timing: 'after',
    tone: 'calm',
    message: 'Take a moment to appreciate what you just did for yourself. You\'re starting the day right.',
  },
  {
    timing: 'after',
    tone: 'calm',
    message: 'Reflect: What did you notice during today\'s run? What insights came up?',
  },
  {
    timing: 'after',
    tone: 'calm',
    message: 'You\'re building a ritual that serves you. How does this morning practice affect your day?',
  },
  {
    timing: 'after',
    tone: 'calm',
    message: 'Well done. Carry this sense of calm and accomplishment into the rest of your day.',
  },
];

// ============================================================================
// PLATEAU BREAKER CHALLENGE (Analytical Tone)
// ============================================================================

export const PLATEAU_BREAKER_PROMPTS_BEFORE: ChallengePrompt[] = [
  {
    timing: 'before',
    tone: 'analytical',
    message: 'Today\'s workout is designed to stress your aerobic system. Focus on hitting the prescribed paces.',
  },
  {
    timing: 'before',
    tone: 'analytical',
    message: 'This speed session will feel hard. That\'s the point. Adaptation happens at the edge of comfort.',
  },
  {
    timing: 'before',
    tone: 'analytical',
    message: 'Hills today. Focus on maintaining effort (not pace) on the uphill. Let gravity work on the down.',
  },
  {
    timing: 'before',
    tone: 'analytical',
    message: 'Easy run today. Resist the urge to go hard. Recovery is when you get stronger.',
  },
  {
    timing: 'before',
    tone: 'analytical',
    message: 'Tempo run: Find your comfortably hard pace. You should be able to speak 2-3 words at a time.',
  },
];

export const PLATEAU_BREAKER_PROMPTS_AFTER: ChallengePrompt[] = [
  {
    timing: 'after',
    tone: 'analytical',
    message: 'Good work. How did the paces feel? Rate your effort from 1-10 for our adaptive algorithm.',
  },
  {
    timing: 'after',
    tone: 'analytical',
    message: 'Solid session. Your body is adapting to these stimuli. Progress happens in recovery.',
  },
  {
    timing: 'after',
    tone: 'analytical',
    message: 'Data logged. Notice any improvements from last week? Check your metrics in the progress tab.',
  },
  {
    timing: 'after',
    tone: 'analytical',
    message: 'Session complete. How did your heart rate respond? Lower HR at same pace = improving fitness.',
  },
  {
    timing: 'after',
    tone: 'analytical',
    message: 'Well executed. The variety in training is what breaks plateaus. You\'re doing it right.',
  },
];

// ============================================================================
// MICRO LESSONS - "Why This Matters"
// ============================================================================

export const MICRO_LESSONS: Record<string, string[]> = {
  'start-running': [
    '🎯 Why showing up matters: Consistency beats intensity every time. Missing a run breaks the habit, not your fitness.',
    '💪 Why walk breaks work: They prevent injury and burnout. All beginner plans use them because they work.',
    '🧠 The habit formation science: 21 days isn\'t magic, but it\'s enough to make running feel normal, not foreign.',
    '❤️ Why you feel good after: Endorphins are real. You\'re literally rewiring your brain to crave this feeling.',
    '⏱️ Why we focus on time: Distance varies with terrain and fatigue. Time keeps you honest and safe.',
    '🏃 Building your aerobic base: Most running should feel easy. This builds the foundation for everything else.',
    '🎉 The compound effect: Each run makes the next one slightly easier. You\'re investing in future you.',
    '😴 Why rest matters: Your body adapts during rest, not during the run. Rest days make you faster.',
    '👟 Why new runners quit: They go too hard, too fast, and get hurt. We\'re not making that mistake.',
    '🚀 The 10% rule: Increase volume by max 10% per week. Slow growth = sustainable growth.',
    '📈 Progress isn\'t linear: Some days feel hard, some easy. That\'s normal. The trend is what matters.',
    '🧘 Mental toughness: Running teaches you that discomfort is temporary. Life skill unlocked.',
    '🔥 Why streaks work: Momentum is powerful. Breaking a streak feels worse than maintaining it.',
    '💭 The inner critic: That voice saying "you can\'t" gets quieter every run. Today you\'re proving it wrong.',
    '🌅 Morning vs evening: Run when you\'ll actually do it. Consistency > perfect timing.',
    '👥 You\'re not alone: Millions started exactly where you are. Most stuck with it. You will too.',
    '🎨 Form follows function: Don\'t overthink form yet. Your body will find efficiency naturally.',
    '🏅 Defining yourself: You\'re becoming someone who runs. That identity shift is happening now.',
    '📊 Tracking progress: We log runs not for ego, but to see how far you\'ve come on hard days.',
    '🌟 Week 3 is critical: This is when quitters quit. Push through, and you\'re golden.',
    '🎊 Graduation day: You did 21 days. You\'re not a beginner anymore. You\'re a runner.',
  ],
  'morning-ritual': [
    '🌅 Why mornings work: Decision fatigue hasn\'t kicked in. Evening plans often fail. Mornings stick.',
    '🧘 Running as meditation: The repetitive motion quiets the monkey mind. It\'s moving meditation.',
    '🌬️ Breath awareness: Noticing your breath during running trains mindfulness off the run too.',
    '🎯 Setting intentions: A morning intention shapes your entire day. This run is your anchor.',
    '❤️ Cardiovascular + mental health: Running reduces anxiety and depression as effectively as medication.',
    '😊 The morning advantage: Morning runners are 50% more likely to still be running a year later.',
    '🕐 Circadian rhythm: Morning exercise helps regulate sleep. Better runs → Better sleep → Better runs.',
    '🧠 Neuroplasticity: Morning running + reflection literally rewires your brain for positivity.',
    '💪 Discipline vs motivation: Motivation fades. Your morning ritual runs on discipline and habit.',
    '🌈 Starting the day right: Accomplishment before breakfast sets a positive tone for everything else.',
    '🔄 The feedback loop: Better mornings → Better days → Better sleep → Better mornings.',
    '🏃 Consistency compounds: Miss a morning run and you\'ve lost the day\'s momentum. Protect this ritual.',
    '🎨 Your personal practice: This run is yours. Not for followers, pace, or distance. Just for you.',
    '😌 Stress inoculation: Morning running trains your body to handle stress better all day.',
    '📿 Mindfulness practice: Observing without judgment during runs teaches you to do it everywhere.',
    '🙏 Gratitude priming: Grateful running → Grateful living. It\'s that simple.',
    '⚡ Energy paradox: Spending energy running actually gives you more energy for the day. Weird but true.',
    '🧘 The observer mind: Noticing your thoughts during running without engaging is meditation mastery.',
    '🌟 Identity shift: You\'re not someone who tries to run mornings. You\'re a morning runner now.',
    '🎯 Non-negotiable time: This hour is sacred. Protecting it teaches you to protect other boundaries.',
    '🎊 Ritual complete: 21 mornings later, this isn\'t a challenge anymore. It\'s who you are.',
  ],
  'plateau-breaker': [
    '📊 Why variety matters: Your body adapts to repeated stimulus. Variation = continued adaptation.',
    '⚡ The speed work principle: Short bursts at high intensity improve your aerobic capacity dramatically.',
    '⛰️ Why hills work: They build strength and power without the impact of flat speed work. Smart training.',
    '🎯 Threshold runs explained: Running at lactate threshold trains your body to clear lactate faster.',
    '💪 Progressive overload: You must gradually increase stress on the body to keep improving. That\'s today.',
    '😴 Recovery is training: Hard days stimulate. Easy days allow adaptation. Both are essential.',
    '📈 The 80/20 rule: 80% easy, 20% hard. Most runners flip this and plateau. You\'re doing it right.',
    '🧠 Mental breakthrough: Speed work teaches your brain that you can go faster than you think.',
    '❤️ Heart rate training: Training by feel works. Adding HR zones makes it scientific and effective.',
    '🔄 Adaptation timeline: Noticeable improvements take 4-6 weeks. Trust the process. It\'s working.',
    '🏃 Running economy: Your body becomes more efficient at using oxygen. Same pace = less effort.',
    '⏱️ Why intervals work: The rest between efforts is when adaptation happens. Work + rest = growth.',
    '🎨 Fartlek philosophy: Swedish for "speed play". Unstructured speed is fun and effective. Win-win.',
    '🧘 Tempo runs: They\'re called "comfortably hard" for a reason. Finding that edge is the skill.',
    '💡 The plateau myth: You didn\'t plateau. Your body adapted to your training. Change = growth.',
    '🏅 Performance markers: Track not just pace, but HR at same pace. That\'s where you see improvement.',
    '😅 Discomfort tolerance: Getting comfortable being uncomfortable is the secret to breaking through.',
    '🎯 Specificity principle: Want to run faster? You must practice running faster. Obvious but often ignored.',
    '📊 Data-driven decisions: We adjust based on your feedback and data, not generic plans. That\'s the edge.',
    '🌟 Breakthrough confirmed: Your paces have improved. The plateau is in your rearview mirror.',
    '🎊 New baseline: What felt hard at day 1 is your easy pace now. Ready for the next level?',
  ],
};

/**
 * Get a random prompt of specified timing and tone
 */
export function getRandomPrompt(
  timing: 'before' | 'after',
  tone: ChallengePrompt['tone']
): string {
  let prompts: ChallengePrompt[] = [];

  if (tone === 'gentle') {
    prompts = timing === 'before' ? START_RUNNING_PROMPTS_BEFORE : START_RUNNING_PROMPTS_AFTER;
  } else if (tone === 'calm') {
    prompts =
      timing === 'before' ? MORNING_RITUAL_PROMPTS_BEFORE : MORNING_RITUAL_PROMPTS_AFTER;
  } else if (tone === 'analytical') {
    prompts =
      timing === 'before' ? PLATEAU_BREAKER_PROMPTS_BEFORE : PLATEAU_BREAKER_PROMPTS_AFTER;
  }

  if (prompts.length === 0) {
    return timing === 'before'
      ? 'Ready to run? Let\'s do this!'
      : 'Great job completing your run!';
  }

  const randomIndex = Math.floor(Math.random() * prompts.length);
  return prompts[randomIndex]?.message ?? 'Keep going!';
}

/**
 * Get micro lesson for a specific day and challenge slug
 */
export function getMicroLesson(challengeSlug: string, day: number): string {
  const lessons = MICRO_LESSONS[challengeSlug];
  if (!lessons || day < 1 || day > lessons.length) {
    return '💡 Every run is a win. You\'re building something sustainable here.';
  }

  return lessons[day - 1] ?? lessons[0] ?? '';
}
