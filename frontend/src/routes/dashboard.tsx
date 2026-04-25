import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Atom, Sparkles, FlaskConical, Package, DollarSign, Calendar, ShieldCheck } from "lucide-react";
import { DOMAINS, type Domain, type PraxisPlan } from "@/lib/praxis-types";
import { GenerationStepper } from "@/components/praxis/GenerationStepper";
import { NoveltyBadge } from "@/components/praxis/NoveltyBadge";
import { MaterialsTable } from "@/components/praxis/MaterialsTable";
import { ProtocolView, BudgetView, TimelineView, ValidationView } from "@/components/praxis/PlanViews";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mission Control — Praxis" }, { name: "description", content: "AI-powered experiment planning dashboard." }] }),
  component: Dashboard,
});

function Dashboard() {
  const [hypothesis, setHypothesis] = useState("");
  const [domain, setDomain] = useState<Domain>("Gut Health");
  const [reviewMode, setReviewMode] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [plan, setPlan] = useState<PraxisPlan | null>(null);
  const [generating, setGenerating] = useState(false);

  const apiBase =
    import.meta.env.VITE_PRAXIS_API_URL ||
    (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "");

  const generate = async () => {
    if (!hypothesis.trim()) return toast.error("Enter a hypothesis first.");
    setGenerating(true);
    setPlan(null);
    setActiveStep(0);

    // Animate stepper
    const stepInterval = setInterval(() => {
      setActiveStep((s) => (s < 3 ? s + 1 : s));
    }, 700);

    try {
      const resp = await fetch(`${apiBase}/api/praxis/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis, domain }),
      });
      const payloadUnknown: unknown = await resp.json();
      clearInterval(stepInterval);
      if (!resp.ok) {
        const msg =
          typeof payloadUnknown === "object" &&
          payloadUnknown !== null &&
          "error" in payloadUnknown &&
          typeof (payloadUnknown as { error?: unknown }).error === "string"
            ? (payloadUnknown as { error: string }).error
            : `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      setActiveStep(4);
      setPlan(payloadUnknown as PraxisPlan);
      toast.success("Experiment plan ready.");
    } catch (e) {
      clearInterval(stepInterval);
      setActiveStep(-1);
      toast.error((e as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 bg-background/80 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center">
            <Atom className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Praxis</span>
          <span className="text-xs font-mono text-muted-foreground ml-2 px-1.5 py-0.5 rounded border border-border">Mission Control</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm">Home</Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="lg:w-[360px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-sidebar p-5 lg:p-6 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="size-4 text-primary" />
                <h2 className="font-semibold">New Experiment</h2>
              </div>
              <p className="text-xs text-muted-foreground">Define your hypothesis and let the agent pipeline build a runnable plan.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hypothesis" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Scientific Hypothesis</Label>
              <Textarea
                id="hypothesis"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="e.g., Daily inulin supplementation increases Bifidobacterium abundance and reduces serum LPS in adults with IBS..."
                rows={6}
                className="bg-background/50 resize-none font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Domain</Label>
              <Select value={domain} onValueChange={(v) => setDomain(v as Domain)}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generate}
              disabled={generating}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-accent glow gap-2"
            >
              <Sparkles className="size-4" />
              {generating ? "Generating..." : "Generate Experiment Plan"}
            </Button>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50">
              <div>
                <Label htmlFor="review" className="text-sm font-medium cursor-pointer">Scientist Review Mode</Label>
                <p className="text-xs text-muted-foreground">Rate sections & submit corrections</p>
              </div>
              <Switch id="review" checked={reviewMode} onCheckedChange={setReviewMode} />
            </div>

            {generating && <GenerationStepper activeStep={activeStep} />}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-5 md:p-8 overflow-x-auto">
          {!plan && !generating && <EmptyState />}
          {generating && !plan && (
            <div className="grid place-items-center min-h-[60vh]">
              <div className="text-center max-w-md">
                <div className="size-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center glow">
                  <FlaskConical className="size-8 text-primary-foreground animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold">Synthesizing your plan</h3>
                <p className="text-sm text-muted-foreground mt-2">Agents are parsing literature, validating novelty, and assembling protocol sections.</p>
              </div>
            </div>
          )}
          {plan && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Experiment Plan</div>
                <h1 className="text-2xl font-bold tracking-tight mt-1 line-clamp-2">{plan.meta.hypothesis}</h1>
                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full border border-border">{plan.meta.domain}</span>
                  <span>· generated {new Date(plan.meta.generated_at).toLocaleString()}</span>
                </div>
              </div>

              <NoveltyBadge novelty={plan.novelty} />

              <Tabs defaultValue="protocol" className="w-full">
                <TabsList className="bg-surface/50 border border-border">
                  <TabsTrigger value="protocol"><FlaskConical className="size-4 mr-1.5" />Protocol</TabsTrigger>
                  <TabsTrigger value="materials"><Package className="size-4 mr-1.5" />Materials</TabsTrigger>
                  <TabsTrigger value="budget"><DollarSign className="size-4 mr-1.5" />Budget</TabsTrigger>
                  <TabsTrigger value="timeline"><Calendar className="size-4 mr-1.5" />Timeline</TabsTrigger>
                  <TabsTrigger value="validation"><ShieldCheck className="size-4 mr-1.5" />Validation</TabsTrigger>
                </TabsList>
                <TabsContent value="protocol" className="mt-6">
                  <ProtocolView
                    steps={plan.protocol}
                    reviewMode={reviewMode}
                    planId={plan.meta.plan_id}
                    experimentType={plan.meta.experiment_type}
                    domainUi={domain}
                  />
                </TabsContent>
                <TabsContent value="materials" className="mt-6">
                  <MaterialsTable
                    materials={plan.materials}
                    reviewMode={reviewMode}
                    planId={plan.meta.plan_id}
                    experimentType={plan.meta.experiment_type}
                    domainUi={domain}
                  />
                </TabsContent>
                <TabsContent value="budget" className="mt-6">
                  <BudgetView
                    budget={plan.budget}
                    reviewMode={reviewMode}
                    planId={plan.meta.plan_id}
                    experimentType={plan.meta.experiment_type}
                    domainUi={domain}
                  />
                </TabsContent>
                <TabsContent value="timeline" className="mt-6">
                  <TimelineView
                    timeline={plan.timeline}
                    reviewMode={reviewMode}
                    planId={plan.meta.plan_id}
                    experimentType={plan.meta.experiment_type}
                    domainUi={domain}
                  />
                </TabsContent>
                <TabsContent value="validation" className="mt-6">
                  <ValidationView
                    validation={plan.validation}
                    reviewMode={reviewMode}
                    planId={plan.meta.plan_id}
                    experimentType={plan.meta.experiment_type}
                    domainUi={domain}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="size-16 mx-auto mb-4 rounded-2xl glass grid place-items-center">
          <FlaskConical className="size-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Mission Control standing by</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Enter a scientific hypothesis in the sidebar and choose a domain. The agent pipeline will generate a complete, runnable experiment plan.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
          {["Protocol", "Materials", "Budget", "Timeline"].map((k) => (
            <div key={k} className="px-3 py-2 rounded border border-dashed border-border">{k}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
