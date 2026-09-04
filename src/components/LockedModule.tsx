import { ArrowRight, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LockedModule({ title, description, onOpenStore }: { title: string; description: string; onOpenStore: () => void }) {
  return <section className="locked-module panel">
    <span className="locked-module-icon"><LockKeyhole /></span>
    <p className="kicker">MÓDULO OPCIONAL</p>
    <h1>{title}</h1>
    <p>{description}</p>
    <Button onClick={onOpenStore}>Ver módulo e preço <ArrowRight size={17} /></Button>
  </section>
}
