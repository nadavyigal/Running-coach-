"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield, Download, Trash2, Eye, Settings, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface UserPrivacySettings {
  dataCollection: {
    location: boolean;
    performance: boolean;
    analytics: boolean;
    coaching: boolean;
  };
  consentHistory: Array<{
    timestamp: Date;
    consentType: string;
    granted: boolean;
  }>;
  exportData: boolean;
  deleteData: boolean;
}

interface PrivacyDashboardProps {
  user: {
    id?: number;
    name?: string;
    privacySettings?: UserPrivacySettings;
  };
  onSettingsChange: (settings: UserPrivacySettings) => void;
}

export function PrivacyDashboard({ user, onSettingsChange }: PrivacyDashboardProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Initialize default privacy settings if not present
  const defaultSettings: UserPrivacySettings = {
    dataCollection: {
      location: true,
      performance: true,
      analytics: true,
      coaching: true,
    },
    consentHistory: [],
    exportData: false,
    deleteData: false,
  }

  const [settings, setSettings] = useState<UserPrivacySettings>(
    user.privacySettings || defaultSettings
  )

  const handleSettingChange = (category: keyof UserPrivacySettings['dataCollection'], value: boolean) => {
    const newSettings = {
      ...settings,
      dataCollection: {
        ...settings.dataCollection,
        [category]: value,
      },
    }
    
    // Add to consent history
    newSettings.consentHistory.push({
      timestamp: new Date(),
      consentType: category,
      granted: value,
    })

    setSettings(newSettings)
    onSettingsChange(newSettings)
    
    toast({
      title: "Privacy Setting Updated",
      description: `${category} data collection ${value ? 'enabled' : 'disabled'}`,
    })
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      // Simulate data export
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const exportData = {
        user: {
          id: user.id,
          name: user.name,
        },
        privacySettings: settings,
        exportDate: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `run-smart-privacy-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Data Exported",
        description: "Your privacy data has been downloaded successfully.",
      })
    } catch {
      toast({
        title: "Export Failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteData = async () => {
    setIsDeleting(true)
    try {
      // Simulate data deletion
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const newSettings = {
        ...settings,
        dataCollection: {
          location: false,
          performance: false,
          analytics: false,
          coaching: false,
        },
        deleteData: true,
      }
      
      setSettings(newSettings)
      onSettingsChange(newSettings)

      toast({
        title: "Data Deletion Requested",
        description: "Your data deletion request has been submitted. This process may take up to 30 days.",
      })
    } catch {
      toast({
        title: "Deletion Failed",
        description: "Failed to submit deletion request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const dataCollectionCategories = [
    {
      key: 'location',
      title: 'Location Data',
      description: 'GPS coordinates for route tracking and distance calculation',
      icon: Eye,
      required: true,
    },
    {
      key: 'performance',
      title: 'Performance Metrics',
      description: 'Running pace, heart rate, and training load data',
      icon: Settings,
      required: true,
    },
    {
      key: 'analytics',
      title: 'Analytics & Insights',
      description: 'Usage patterns and app performance data',
      icon: Info,
      required: false,
    },
    {
      key: 'coaching',
      title: 'AI Coaching Data',
      description: 'Conversation history and coaching preferences',
      icon: Shield,
      required: false,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Shield className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold">Privacy & Data Control</h2>
        </div>
        <p className="text-gray-600">
          Control what data we collect and how it&apos;s used to improve your running experience
        </p>
      </div>

      {/* Data Collection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            Data Collection Preferences
          </CardTitle>
          <CardDescription>
            Choose what data you want to share with Run-Smart
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataCollectionCategories.map((category) => (
            <div key={category.key} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <category.icon className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{category.title}</h3>
                    {category.required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
              <Switch
                checked={settings.dataCollection[category.key as keyof UserPrivacySettings['dataCollection']]}
                onCheckedChange={(checked) => 
                  handleSettingChange(category.key as keyof UserPrivacySettings['dataCollection'], checked)
                }
                disabled={category.required}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Consent History */}
      <Card>
        <CardHeader>
          <CardTitle>Consent History</CardTitle>
          <CardDescription>
            Track your privacy decisions over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="consent-history">
              <AccordionTrigger>View Consent History</AccordionTrigger>
              <AccordionContent>
                {settings.consentHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No consent changes recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {settings.consentHistory.slice(-5).reverse().map((consent, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{consent.consentType}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(consent.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={consent.granted ? "default" : "secondary"}>
                          {consent.granted ? "Granted" : "Denied"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Control Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              Export Your Data
            </CardTitle>
            <CardDescription>
              Download a copy of all your data in JSON format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleExportData} 
              disabled={isExporting}
              className="w-full"
              variant="outline"
            >
              {isExporting ? "Exporting..." : "Export Data"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5" />
              Delete Your Data
            </CardTitle>
            <CardDescription>
              Request permanent deletion of all your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleDeleteData} 
              disabled={isDeleting}
              className="w-full"
              variant="destructive"
            >
              {isDeleting ? "Processing..." : "Request Deletion"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* GDPR Compliance Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">GDPR Compliance</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <p className="text-sm">
            Run-Smart is committed to protecting your privacy and complying with GDPR regulations. 
            You have the right to access, modify, and delete your personal data at any time. 
            All data processing is transparent and you can withdraw consent at any moment.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 
