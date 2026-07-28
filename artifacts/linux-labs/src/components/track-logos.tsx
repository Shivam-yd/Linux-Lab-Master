import type { SVGProps } from "react"
import {
  siLinux, siTerraform, siJenkins, siDocker, siGit,
  siKubernetes, siAnsible,
} from "simple-icons"

type LogoProps = SVGProps<SVGSVGElement> & { className?: string }

function BrandIcon({ icon, ...props }: LogoProps & { icon: { path: string } }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d={icon.path} />
    </svg>
  )
}

export const LinuxLogo      = (p: LogoProps) => <BrandIcon icon={siLinux}      {...p} />
export const TerraformLogo  = (p: LogoProps) => <BrandIcon icon={siTerraform}  {...p} />
export const JenkinsLogo    = (p: LogoProps) => <BrandIcon icon={siJenkins}    {...p} />
export const DockerLogo     = (p: LogoProps) => <BrandIcon icon={siDocker}     {...p} />
export const GitLogo        = (p: LogoProps) => <BrandIcon icon={siGit}        {...p} />
export const KubernetesLogo = (p: LogoProps) => <BrandIcon icon={siKubernetes} {...p} />
export const AnsibleLogo    = (p: LogoProps) => <BrandIcon icon={siAnsible}    {...p} />
