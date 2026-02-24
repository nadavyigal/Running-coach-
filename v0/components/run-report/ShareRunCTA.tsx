import { Share2, ChevronRight } from 'lucide-react'

interface ShareRunCTAProps {
    onShare: () => void
}

export function ShareRunCTA({ onShare }: ShareRunCTAProps) {
    return (
        <div className="mt-8 mb-4">
            <button
                onClick={onShare}
                className="w-full relative overflow-hidden group rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-1 shadow-lg hover:shadow-primary/25 transition-all duration-300"
            >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />

                <div className="relative flex items-center justify-between bg-black/10 backdrop-blur-sm p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full">
                            <Share2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-white tracking-wide">Share Your Run</div>
                            <div className="text-xs text-white/80 font-medium">Create a beautiful card for Instagram or WhatsApp</div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors group-hover:translate-x-1 duration-300" />
                </div>
            </button>
        </div>
    )
}
