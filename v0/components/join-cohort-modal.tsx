import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';

interface JoinCohortModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number; // Assuming userId is available from the parent component
}

export const JoinCohortModal: React.FC<JoinCohortModalProps> = ({ isOpen, onClose, userId }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleJoinCohort = async () => {
    if (!inviteCode) {
      toast({
        title: 'Error',
        description: 'Please enter an invite code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/cohort/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode, userId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: data.message || 'Successfully joined cohort!',
        });
        onClose(); // Close modal on success
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to join cohort.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error joining cohort:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a Community Cohort</DialogTitle>
          <DialogDescription>
            Enter the invite code provided by your cohort leader to join.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="inviteCode" className="text-right">
              Invite Code
            </Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="col-span-3"
              placeholder="e.g., RUNNERS2024"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleJoinCohort} disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Cohort'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
