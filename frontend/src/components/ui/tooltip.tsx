import * as React from "react"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export function Tooltip({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {children}
        </div>
    )
}

export function TooltipTrigger({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) {
    return <>{children}</>
}

export function TooltipContent({ children, side, className }: { children: React.ReactNode, side?: string, className?: string }) {
    // Simple CSS based tooltip content that shows on parent hover
    return (
        <div className={`
      absolute invisible group-hover:visible opacity-0 group-hover:opacity-100
      transition-all duration-200 z-[100]
      ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}
      left-1/2 -translate-x-1/2
      pointer-events-none group-hover:pointer-events-auto
      ${className}
    `}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-2xl min-w-[200px]">
                {children}
            </div>
        </div>
    )
}
