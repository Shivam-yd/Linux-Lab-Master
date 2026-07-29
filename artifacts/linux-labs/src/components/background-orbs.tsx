import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

function Orb({ className, color, xRange, yRange, duration }: {
  className: string
  color: string
  xRange: [number, number]
  yRange: [number, number]
  duration: number
}) {
  return (
    <motion.div
      className={cn("absolute rounded-full pointer-events-none", className)}
      style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      animate={{ x: [0, xRange[0], xRange[1], 0], y: [0, yRange[0], yRange[1], 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", repeatType: "loop" }}
    />
  )
}

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <Orb className="w-[560px] h-[560px] -top-28 -left-20"
        color="rgba(13,148,136,0.13)" xRange={[28, -14]} yRange={[-18, 10]} duration={14} />
      <Orb className="w-[440px] h-[440px] top-[18%] -right-20"
        color="rgba(124,58,237,0.10)" xRange={[-22, 12]} yRange={[26, -10]} duration={17} />
      <Orb className="w-[360px] h-[360px] bottom-[12%] left-[35%]"
        color="rgba(5,150,105,0.09)" xRange={[18, -10]} yRange={[14, -20]} duration={20} />
    </div>
  )
}
