import { Terminal, Layers, Server, Container, GitBranch, Cpu, ShipWheel, Settings } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type TrackMeta = {
  label: string
  description: string
  icon: LucideIcon
  accentClass: string
  accentHex: string
  bgClass: string
  gradient: string
  comingSoon?: boolean
}

export const TRACK_META: Record<string, TrackMeta> = {
  linux: {
    label: "Linux",
    description: "Master the command line, permissions, users, scripting, and automation.",
    icon: Terminal,
    accentClass: "text-cyan-400",
    accentHex: "#22d3ee",
    bgClass: "bg-cyan-400/10",
    gradient: "from-cyan-500/20 to-blue-500/10",
  },
  terraform: {
    label: "Terraform",
    description: "Learn Infrastructure as Code — write, plan, and apply real configs.",
    icon: Layers,
    accentClass: "text-purple-400",
    accentHex: "#c084fc",
    bgClass: "bg-purple-400/10",
    gradient: "from-purple-500/20 to-pink-500/10",
  },
  jenkins: {
    label: "Jenkins",
    description: "Master CI/CD pipelines — install, configure, and manage Jenkins automation.",
    icon: Server,
    accentClass: "text-orange-400",
    accentHex: "#f97316",
    bgClass: "bg-orange-400/10",
    gradient: "from-orange-500/20 to-yellow-500/10",
  },
  docker: {
    label: "Docker",
    description: "Learn containers from the ground up — images, running containers, Dockerfiles, and volumes.",
    icon: Container,
    accentClass: "text-sky-400",
    accentHex: "#38bdf8",
    bgClass: "bg-sky-400/10",
    gradient: "from-sky-500/20 to-blue-500/10",
  },
  git: {
    label: "Git",
    description: "Master version control — commits, branches, merges, remotes, and undoing mistakes.",
    icon: GitBranch,
    accentClass: "text-red-400",
    accentHex: "#f87171",
    bgClass: "bg-red-400/10",
    gradient: "from-red-500/20 to-orange-500/10",
  },
  kubernetes: {
    label: "Kubernetes",
    description: "Coming soon — orchestrate containers with pods, services, deployments, and Helm.",
    icon: ShipWheel,
    accentClass: "text-blue-400",
    accentHex: "#60a5fa",
    bgClass: "bg-blue-400/10",
    gradient: "from-blue-500/20 to-indigo-500/10",
    comingSoon: true,
  },
  ansible: {
    label: "Ansible",
    description: "Coming soon — automate configuration, provisioning, and deployment at scale.",
    icon: Settings,
    accentClass: "text-emerald-400",
    accentHex: "#34d399",
    bgClass: "bg-emerald-400/10",
    gradient: "from-emerald-500/20 to-teal-500/10",
    comingSoon: true,
  },
}

export const DEFAULT_TRACK_META: TrackMeta = {
  label: "Unknown",
  description: "",
  icon: Cpu,
  accentClass: "text-slate-400",
  accentHex: "#94a3b8",
  bgClass: "bg-slate-400/10",
  gradient: "from-slate-500/20 to-gray-500/10",
}
