'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  Clock, 
  Target, 
  Flag, 
  Calendar,
  Star,
  TrendingUp,
  Award,
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { MilestoneCelebration, useMilestoneCelebration } from './milestone-celebration';
import { toast } from '@/components/ui/use-toast';

interface MilestoneTrackerProps {
  goalId: number;
  goalTitle: string;
  goalType: string;
  targetUnit: string;
  userId: number;
  className?: string;
}

interface Milestone {
  id: number;
  goalId: number;
  title: string;
  description: string;
  targetValue: number;
  targetDate: Date;
  status: 'pending' | 'active' | 'achieved' | 'missed';
  category: 'minor' | 'major' | 'critical';
  sequenceOrder: number;
  achievedAt?: Date;
  achievedValue?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function MilestoneTracker({ 
  goalId, 
  goalTitle, 
  goalType, 
  targetUnit,
  userId, 
  className = '' 
}: MilestoneTrackerProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [achievementNotes, setAchievementNotes] = useState('');
  
  const { celebrationData, showCelebration, closeCelebration } = useMilestoneCelebration();

  useEffect(() => {
    loadMilestones();
  }, [goalId]);

  const loadMilestones = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/goals/milestones?goalId=${goalId}`);
      
      if (response.ok) {
        const data = await response.json();
        setMilestones(data.milestones || []);
      } else {
        console.error('Failed to load milestones');
      }
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMilestoneAchieved = async (milestoneId: number, notes?: string) => {
    try {
      const response = await fetch('/api/goals/milestones/achieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId,
          achievedAt: new Date().toISOString(),
          notes: notes || achievementNotes
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local milestones
        setMilestones(prev => prev.map(m => 
          m.id === milestoneId 
            ? { ...m, status: 'achieved', achievedAt: new Date(), notes: notes || achievementNotes }
            : m
        ));

        // Show celebration if milestone was achieved
        if (data.celebration) {
          const achievedMilestone = milestones.find(m => m.id === milestoneId);
          if (achievedMilestone) {
            showCelebration([achievedMilestone], goalTitle);
          }
        }

        toast({
          variant: "success",
          title: "Milestone Achieved! 🎉",
          description: data.message || "Great job reaching this milestone!",
        });

        setAchievementNotes('');
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Failed to mark milestone",
          description: error.message || "Please try again.",
        });
      }
    } catch (error) {
      console.error('Error marking milestone achieved:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update milestone status.",
      });
    }
  };

  const updateMilestone = async (milestoneId: number, updates: Partial<Milestone>) => {
    try {
      const response = await fetch('/api/goals/milestones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId,
          ...updates
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMilestones(prev => prev.map(m => 
          m.id === milestoneId ? { ...m, ...updates } : m
        ));
        
        toast({
          variant: "success",
          title: "Milestone Updated",
          description: "Your milestone has been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'achieved': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'active': return <Play className="h-5 w-5 text-blue-500" />;
      case 'missed': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved': return 'bg-green-100 text-green-800 border-green-200';
      case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'missed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'critical': return <Badge className="bg-purple-100 text-purple-800">Critical</Badge>;
      case 'major': return <Badge className="bg-blue-100 text-blue-800">Major</Badge>;
      case 'minor': return <Badge variant="outline">Minor</Badge>;
      default: return <Badge variant="outline">Standard</Badge>;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'seconds') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${Math.round(value * 10) / 10} ${unit}`;
  };

  const getDaysUntilTarget = (targetDate: Date) => {
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressToNextMilestone = () => {
    const nextMilestone = milestones.find(m => m.status === 'active' || m.status === 'pending');
    if (!nextMilestone) return null;

    // This would need to be calculated based on current goal progress
    // For now, returning a placeholder
    return {
      milestone: nextMilestone,
      progressPercentage: 65 // This should come from actual progress calculation
    };
  };

  const nextProgress = getProgressToNextMilestone();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 animate-pulse text-blue-500" />
            <div className="text-sm text-gray-600">Loading milestones...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Milestone Tracker
          </CardTitle>
          <CardDescription>
            Track your progress through key milestones for "{goalTitle}"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Next Milestone Progress */}
          {nextProgress && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <Target className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">Next Milestone</h4>
                  <p className="text-sm text-blue-700">{nextProgress.milestone.title}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Progress</span>
                  <span className="font-medium text-blue-900">{nextProgress.progressPercentage}%</span>
                </div>
                <Progress value={nextProgress.progressPercentage} className="h-2" />
                <div className="flex justify-between text-xs text-blue-600">
                  <span>Target: {formatValue(nextProgress.milestone.targetValue, targetUnit)}</span>
                  <span>{getDaysUntilTarget(nextProgress.milestone.targetDate)} days left</span>
                </div>
              </div>
            </div>
          )}

          {/* Milestones List */}
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className={`p-4 rounded-lg border-2 transition-all ${getStatusColor(milestone.status)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(milestone.status)}
                    <div>
                      <h4 className="font-medium">{milestone.title}</h4>
                      <p className="text-sm opacity-80">{milestone.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(milestone.category)}
                    <Badge variant="outline" className="text-xs">
                      #{milestone.sequenceOrder}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="opacity-75">Target:</span>
                    <div className="font-medium">
                      {formatValue(milestone.targetValue, targetUnit)}
                    </div>
                  </div>
                  
                  <div>
                    <span className="opacity-75">Due Date:</span>
                    <div className="font-medium">
                      {new Date(milestone.targetDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {milestone.status === 'achieved' && milestone.achievedAt && (
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Star className="h-4 w-4" />
                      <span>Achieved on {new Date(milestone.achievedAt).toLocaleDateString()}</span>
                    </div>
                    {milestone.notes && (
                      <p className="text-sm text-green-600 mt-1 italic">"{milestone.notes}"</p>
                    )}
                  </div>
                )}

                {milestone.status === 'active' && getDaysUntilTarget(milestone.targetDate) < 7 && (
                  <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-center gap-2 text-sm text-yellow-700">
                      <AlertCircle className="h-4 w-4" />
                      <span>Due in {getDaysUntilTarget(milestone.targetDate)} days!</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  {milestone.status === 'active' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Achieved
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Mark Milestone as Achieved</DialogTitle>
                          <DialogDescription>
                            Congratulations on reaching "{milestone.title}"! Add any notes about this achievement.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="achievement-notes">Achievement Notes (Optional)</Label>
                            <Textarea
                              id="achievement-notes"
                              placeholder="How did you feel? What helped you achieve this milestone?"
                              value={achievementNotes}
                              onChange={(e) => setAchievementNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={() => markMilestoneAchieved(milestone.id)}
                            className="flex items-center gap-2"
                          >
                            <Award className="h-4 w-4" />
                            Celebrate Achievement
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMilestone(milestone);
                      setEditNotes(milestone.notes || '');
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {milestones.length === 0 && (
            <div className="text-center py-8">
              <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Milestones Yet</h3>
              <p className="text-gray-600 mb-4">
                Milestones will be automatically generated based on your goal progress.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Milestone Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>
              Update notes or details for this milestone.
            </DialogDescription>
          </DialogHeader>
          {selectedMilestone && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedMilestone.title}</h4>
                <p className="text-sm text-gray-600">{selectedMilestone.description}</p>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Add notes about this milestone..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedMilestone) {
                  updateMilestone(selectedMilestone.id, { notes: editNotes });
                  setShowEditDialog(false);
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Celebration */}
      <MilestoneCelebration
        milestones={celebrationData.milestones}
        goalTitle={celebrationData.goalTitle}
        isOpen={celebrationData.isOpen}
        onClose={closeCelebration}
        onShare={() => {
          // Handle sharing achievement
          toast({
            variant: "success",
            title: "Achievement Shared!",
            description: "Your milestone achievement has been shared.",
          });
        }}
      />
    </div>
  );
}