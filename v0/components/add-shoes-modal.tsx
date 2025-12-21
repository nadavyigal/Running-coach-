"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Footprints } from "lucide-react"

interface AddShoesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddShoesModal({ isOpen, onClose }: AddShoesModalProps) {
  const [shoesData, setShoesData] = useState({
    name: "",
    brand: "",
    model: "",
    initialKm: "",
    maxKm: "800",
  })
  const [startDate, setStartDate] = useState<Date>(new Date())

  const handleSave = () => {
    const shoes = {
      ...shoesData,
      startDate,
      initialKm: Number.parseFloat(shoesData.initialKm) || 0,
      maxKm: Number.parseFloat(shoesData.maxKm),
      currentKm: Number.parseFloat(shoesData.initialKm) || 0,
      id: Date.now().toString(),
    }

    // Save to localStorage for demo
    const existingShoes = JSON.parse(localStorage.getItem("running-shoes") || "[]")
    existingShoes.push(shoes)
    localStorage.setItem("running-shoes", JSON.stringify(existingShoes))

    console.log("Saving shoes:", shoes)
    alert("Running shoes added successfully!")

    // Reset and close
    setShoesData({
      name: "",
      brand: "",
      model: "",
      initialKm: "",
      maxKm: "800",
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Footprints className="h-5 w-5" />
            Add Running Shoes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shoe Name */}
          <div className="space-y-2">
            <Label htmlFor="shoe-name">Shoe Name/Nickname</Label>
            <Input
              id="shoe-name"
              placeholder="e.g. My Daily Trainers"
              value={shoesData.name}
              onChange={(e) => setShoesData({ ...shoesData, name: e.target.value })}
            />
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                placeholder="Nike, Adidas, etc."
                value={shoesData.brand}
                onChange={(e) => setShoesData({ ...shoesData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="Pegasus 39, etc."
                value={shoesData.model}
                onChange={(e) => setShoesData({ ...shoesData, model: e.target.value })}
              />
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Initial Kilometers */}
          <div className="space-y-2">
            <Label htmlFor="initial-km">Initial Kilometers (optional)</Label>
            <div className="relative">
              <Input
                id="initial-km"
                type="number"
                step="0.1"
                placeholder="0"
                value={shoesData.initialKm}
                onChange={(e) => setShoesData({ ...shoesData, initialKm: e.target.value })}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">km</span>
            </div>
            <p className="text-xs text-gray-600">If you&apos;ve already used these shoes, enter the current mileage</p>
          </div>

          {/* Max Kilometers */}
          <div className="space-y-2">
            <Label htmlFor="max-km">Expected Lifespan</Label>
            <div className="relative">
              <Input
                id="max-km"
                type="number"
                step="50"
                value={shoesData.maxKm}
                onChange={(e) => setShoesData({ ...shoesData, maxKm: e.target.value })}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">km</span>
            </div>
            <p className="text-xs text-gray-600">Most running shoes last 600-1000km depending on your running style</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-green-500 hover:bg-green-600"
              disabled={!shoesData.name.trim()}
            >
              Add Shoes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
