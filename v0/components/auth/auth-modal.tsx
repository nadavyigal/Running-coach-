'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignupForm } from './signup-form'
import { LoginForm } from './login-form'

type AuthModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'signup' | 'login'
}

export function AuthModal({ open, onOpenChange, defaultTab = 'signup' }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>(defaultTab)

  const handleSuccess = () => {
    // Close modal on successful auth
    onOpenChange(false)
  }

  const handleSwitchTab = (tab: 'signup' | 'login') => {
    setActiveTab(tab)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to RunSmart AI</DialogTitle>
          <DialogDescription>
            Create an account or log in to save your running data and access it from any device.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signup' | 'login')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="login">Log In</TabsTrigger>
          </TabsList>

          <TabsContent value="signup" className="mt-6">
            <SignupForm
              onSuccess={handleSuccess}
              onSwitchToLogin={() => handleSwitchTab('login')}
            />
          </TabsContent>

          <TabsContent value="login" className="mt-6">
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToSignup={() => handleSwitchTab('signup')}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
