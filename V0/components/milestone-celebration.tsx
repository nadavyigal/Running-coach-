'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Target,
  CheckCircle2,
  Star,
  Award,
  Sparkles,
  Zap,
  Fire,
  Crown,
  Medal,
  PartyPopper,
  Rocket,
  TrendingUp,
  Heart,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MilestoneCelebrationProps {
  milestones: any[];
  goalTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
}

interface MilestoneAchievement {
  id: number;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  unit: string;
  achievedAt: Date;
  celebrationLevel: 'bronze' | 'silver' | 'gold' | 'diamond';
  streakCount?: number;
  personalBest?: boolean;
}

const celebrationIcons = {
  bronze: Medal,
  silver: Award,
  gold: Trophy,
  diamond: Crown
};

const celebrationColors = {
  bronze: 'text-amber-600 bg-amber-50 border-amber-200',
  silver: 'text-gray-600 bg-gray-50 border-gray-200',
  gold: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  diamond: 'text-purple-600 bg-purple-50 border-purple-200'
};

const motivationalMessages = {
  bronze: [
    "Great start! You're building momentum! 🌟",
    "Every journey begins with a single step! 🚀",
    "You're on your way to greatness! 💫"
  ],
  silver: [
    "Impressive progress! You're hitting your stride! ⭐",
    "Your dedication is paying off! 🔥",
    "Keep this momentum going! 🎯"
  ],
  gold: [
    "Outstanding achievement! You're crushing it! 🏆",
    "This is what excellence looks like! ⚡",
    "You're inspiring others with your success! 🌟"
  ],
  diamond: [
    "Legendary performance! You're unstoppable! 👑",
    "This is elite-level achievement! 💎",
    "You've reached new heights of excellence! 🚀"
  ]
};

export function MilestoneCelebration({ 
  milestones, 
  goalTitle, 
  isOpen, 
  onClose, 
  onShare 
}: MilestoneCelebrationProps) {
  const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [playSound, setPlaySound] = useState(false);

  useEffect(() => {
    if (isOpen && milestones.length > 0) {
      setShowConfetti(true);
      setPlaySound(true);
      
      // Reset confetti after animation
      const confettiTimer = setTimeout(() => setShowConfetti(false), 3000);
      
      return () => {
        clearTimeout(confettiTimer);
      };
    }
  }, [isOpen, milestones]);

  const currentMilestone = milestones[currentMilestoneIndex];
  const hasMultipleMilestones = milestones.length > 1;
  
  const goToNext = () => {
    if (currentMilestoneIndex < milestones.length - 1) {
      setCurrentMilestoneIndex(currentMilestoneIndex + 1);
    }
  };
  
  const goToPrevious = () => {
    if (currentMilestoneIndex > 0) {
      setCurrentMilestoneIndex(currentMilestoneIndex - 1);
    }
  };

  const getCelebrationLevel = (milestone: any): 'bronze' | 'silver' | 'gold' | 'diamond' => {
    if (milestone.personalBest) return 'diamond';
    if (milestone.streakCount && milestone.streakCount >= 5) return 'gold';
    if (milestone.category === 'major') return 'silver';
    return 'bronze';
  };

  const getRandomMessage = (level: 'bronze' | 'silver' | 'gold' | 'diamond') => {
    const messages = motivationalMessages[level];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'seconds') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${Math.round(value * 10) / 10} ${unit}`;
  };

  if (!isOpen || milestones.length === 0) {
    return null;
  }

  const celebrationLevel = getCelebrationLevel(currentMilestone);
  const CelebrationIcon = celebrationIcons[celebrationLevel];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence>
          {showConfetti && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Confetti Effect */}
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded"
                  initial={{
                    x: '50%',
                    y: '50%',
                    scale: 0,
                    rotate: 0
                  }}
                  animate={{
                    x: `${50 + (Math.random() - 0.5) * 200}%`,
                    y: `${50 + (Math.random() - 0.5) * 200}%`,
                    scale: [0, 1, 0],
                    rotate: 360 * Math.random()
                  }}
                  transition={{
                    duration: 2,
                    ease: "easeOut",
                    delay: Math.random() * 0.5
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <DialogHeader className="text-center space-y-4">
          <motion.div
            className="mx-auto"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${celebrationColors[celebrationLevel]}`}>
              <CelebrationIcon className="h-8 w-8" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <DialogTitle className="text-2xl font-bold text-center">
              🎉 Milestone Achieved!
            </DialogTitle>
            <DialogDescription className="text-lg text-center mt-2">
              {getRandomMessage(celebrationLevel)}
            </DialogDescription>
          </motion.div>
        </DialogHeader>

        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {/* Goal Context */}
          <div className="text-center">
            <h3 className="font-semibold text-gray-900">{goalTitle}</h3>
            <p className="text-sm text-gray-600 mt-1">Goal Progress</p>
          </div>

          {/* Milestone Details */}
          <Card className={`border-2 ${celebrationColors[celebrationLevel]}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <h4 className="font-semibold">{currentMilestone.title}</h4>
                  <p className="text-sm text-gray-600">{currentMilestone.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Target:</span>
                  <span className="font-semibold">
                    {formatValue(currentMilestone.targetValue, currentMilestone.unit)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Achieved:</span>
                  <span className="text-sm text-gray-500">
                    {new Date(currentMilestone.achievedAt).toLocaleDateString()}
                  </span>
                </div>

                {currentMilestone.personalBest && (
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                    <Star className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700">Personal Best!</span>
                  </div>
                )}

                {currentMilestone.streakCount && currentMilestone.streakCount > 1 && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                    <Fire className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      {currentMilestone.streakCount} milestone streak!
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Multiple Milestones Navigation */}
          {hasMultipleMilestones && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                disabled={currentMilestoneIndex === 0}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                {milestones.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentMilestoneIndex ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={currentMilestoneIndex === milestones.length - 1}
              >
                Next
              </Button>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Milestone {currentMilestoneIndex + 1} of {milestones.length}
            </p>
            <Progress 
              value={((currentMilestoneIndex + 1) / milestones.length) * 100} 
              className="h-2"
            />
          </div>
        </motion.div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {onShare && (
            <Button
              variant="outline"
              onClick={onShare}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Share Achievement
            </Button>
          )}
          
          <Button onClick={onClose} className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Continue Progress
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for milestone celebration management
export function useMilestoneCelebration() {
  const [celebrationData, setCelebrationData] = useState<{
    milestones: any[];
    goalTitle: string;
    isOpen: boolean;
  }>({
    milestones: [],
    goalTitle: '',
    isOpen: false
  });

  const showCelebration = (milestones: any[], goalTitle: string) => {
    setCelebrationData({
      milestones,
      goalTitle,
      isOpen: true
    });
  };

  const closeCelebration = () => {
    setCelebrationData(prev => ({ ...prev, isOpen: false }));
  };

  return {
    celebrationData,
    showCelebration,
    closeCelebration
  };
}