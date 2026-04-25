import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Atom, Workflow, Database, GitBranch, Github, FileText, Users, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Praxis — From Hypothesis to Runnable Experiment Plan" },
      { name: "description", content: "The AI Scientist for Principal Investigators. Agentic orchestration, real supplier catalog grounding, and a feedback loop that learns from your corrections." },
      { property: "og:title", content: "Praxis — AI Experiment Planning" },
      { property: "og:description", content: "From hypothesis to runnable plan in minutes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <header className="relative z-10 border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center glow">
              <Atom className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Praxis</span>
            <span className="text-xs font-mono text-muted-foreground ml-2 px-1.5 py-0.5 rounded border border-border">v0.1</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent">Open Mission Control</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono text-muted-foreground mb-8">
            <span className="size-1.5 rounded-full bg-success pulse-dot" />
            Agentic Orchestration · Live
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-4xl mx-auto leading-[1.05]">
            From Hypothesis to <span className="gradient-text">Runnable Experiment Plan</span> in Minutes.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            The AI Scientist for Principal Investigators. Compressed supply chain, protocol generation, and budget modeling — grounded in real supplier catalogs.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/dashboard">
              <Button size="lg" className="bg-gradient-to-r from-primary to-accent glow gap-2">
                Open Mission Control <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>

          {/* Mini console preview */}
          <div className="mt-20 max-w-3xl mx-auto glass rounded-xl p-1 shadow-elevated">
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50">
              <div className="size-2.5 rounded-full bg-destructive/70" />
              <div className="size-2.5 rounded-full bg-warning/70" />
              <div className="size-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-xs font-mono text-muted-foreground">praxis://mission-control</span>
            </div>
            <div className="p-6 font-mono text-sm text-left space-y-2">
              <div className="text-muted-foreground">$ praxis generate</div>
              <div className="text-success">✓ Parsing hypothesis</div>
              <div className="text-success">✓ Checking literature QC</div>
              <div className="text-success">✓ Fetching RAG context</div>
              <div className="text-primary flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary pulse-dot" />
                Generating plan sections...
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Workflow, title: "Agentic Orchestration", desc: "Chained AI models that think like senior CRO scientists — parsing, validating, and synthesizing." },
              { icon: Database, title: "Real-World Grounding", desc: "Catalog numbers and supply chain costs sourced from major suppliers, not hallucinated." },
              { icon: GitBranch, title: "The Feedback Loop", desc: "RAG-powered learning that continuously improves based on your corrections and reviews." },
            ].map((f) => (
              <div key={f.title} className="glass rounded-xl p-6 hover:border-primary/40 transition group">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center mb-4 group-hover:glow transition">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section className="container mx-auto px-6 py-16">
          <div className="glass rounded-2xl p-10 text-center relative overflow-hidden">
            <Sparkles className="absolute top-6 right-6 size-5 text-primary/40" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ready to compress your research cycle?</h2>
            <p className="mt-3 text-muted-foreground">Join principal investigators using Praxis to plan experiments at the speed of thought.</p>
            <Link to="/dashboard">
              <Button size="lg" className="mt-6 bg-gradient-to-r from-primary to-accent glow">Open Mission Control</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40 mt-12">
        <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Atom className="size-4" />
            <span className="font-mono">© 2026 Praxis Labs</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#" className="flex items-center gap-1.5 hover:text-foreground transition"><Github className="size-4" /> GitHub</a>
            <a href="#" className="flex items-center gap-1.5 hover:text-foreground transition"><FileText className="size-4" /> Technical Docs</a>
            <a href="#" className="flex items-center gap-1.5 hover:text-foreground transition"><Users className="size-4" /> Team</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
