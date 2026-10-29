"use client";

import { cloneElement, useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { whenPosthogReady } from "@/lib/analytics-identity";

const APP_STORE_URL = "https://apps.apple.com/us/app/runsmart-ai-run-coaching/id6768297840";

const GOAL_OPTIONS = [
  { value: "race", label: "Race or target date" },
  { value: "return", label: "Get back to running" },
  { value: "consistency", label: "Run more often" },
  { value: "other", label: "Other" },
];

const RUNS_PER_WEEK_OPTIONS = ["0", "1-2", "3-4", "5+"];

const GROUPS = [
  { name: "Beta club", text: "Free for life. I invite these runners personally, up to 50." },
  {
    name: "Early signers",
    text: "The first 100 runners who register pay $6.49 a month for as long as they stay subscribed. This closes the day paid plans go live.",
  },
  { name: "Everyone else", text: "3 weeks free, then $12.99 a month." },
];

type Status = "idle" | "submitting" | "done";
type FieldErrors = Record<string, string[] | undefined>;

const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// PostHog loads after the page, so wait for it or a page-view event is dropped.
function track(eventName: string, properties: Record<string, unknown>) {
  whenPosthogReady(() => void trackAnalyticsEvent(eventName, properties));
}

function readAttribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("src") ?? params.get("utm_source") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
  };
}

type ControlProps = { "aria-invalid"?: boolean; "aria-describedby"?: string };

// Links the server's error message to the control so screen readers announce it.
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactElement<ControlProps> }) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {cloneElement(children, error ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function YesNo({
  name,
  legend,
  value,
  error,
  onChange,
}: {
  name: string;
  legend: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset
      className="space-y-1.5"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {["yes", "no"].map((option) => (
          <label
            key={option}
            className={`flex h-11 cursor-pointer items-center justify-center rounded-md border text-base capitalize ${
              value === option ? "border-primary bg-primary/10 font-semibold" : "border-input bg-background"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              required
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function AppStoreBadge({ onClick }: { onClick: () => void }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-base font-semibold text-white hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
    >
      <Download className="h-5 w-5" aria-hidden />
      Download on the App Store
    </a>
  );
}

export default function BetaClient() {
  const attribution = useRef({ source: "", utmCampaign: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hasIphone, setHasIphone] = useState("");
  const [returningAfterBreak, setReturningAfterBreak] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    attribution.current = readAttribution();
    track("beta_page_viewed", {
      source: attribution.current.source || "direct",
      utm_campaign: attribution.current.utmCampaign || undefined,
    });
  }, []);

  const trackAppStoreClick = (placement: string) => {
    track("beta_app_store_clicked", {
      placement,
      source: attribution.current.source || "direct",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    setStatus("submitting");
    setFormError("");
    setFieldErrors({});

    const payload = {
      fullName: text("fullName"),
      email: text("email"),
      linkedinUrl: text("linkedinUrl"),
      country: text("country"),
      hasIphone: text("hasIphone"),
      goal: text("goal"),
      raceDate: text("raceDate"),
      returningAfterBreak: text("returningAfterBreak"),
      runsPerWeekNow: text("runsPerWeekNow"),
      source: attribution.current.source,
      utmCampaign: attribution.current.utmCampaign,
      consent: form.get("consent") === "on",
      hpField: text("rs_hp_field"),
    };

    try {
      const response = await fetch("/api/beta/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      track("beta_registration_submitted", {
        success: response.ok,
        status: response.status,
        goal: payload.goal,
        has_iphone: payload.hasIphone,
        returning_after_break: payload.returningAfterBreak,
        source: attribution.current.source || "direct",
      });

      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        setFormError(result.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setFormError("Something went wrong. Please check your connection and try again.");
      setStatus("idle");
    }
  };

  const errorFor = (key: string) => Object.entries(fieldErrors).find(([field]) => field === key)?.[1]?.[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-8 sm:pt-12">
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <Image src="/icon-192x192.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">RunSmart beta</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            When your week changes, your next run is still ready.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            RunSmart is a running coach app for iPhone. Set your race or target date. When you miss a run or your
            week shifts, it gives you a next workout you can do.
          </p>
          <p className="text-base leading-relaxed">
            I&apos;m looking for runners coming back after a break. Run with it for 4 weeks and tell me honestly what
            breaks.
          </p>
        </header>

        <section aria-labelledby="step-1" className="mt-8 rounded-2xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1</p>
          <h2 id="step-1" className="mt-1 text-xl font-semibold">
            Get the app
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Free to download. iPhone only for now.</p>
          <div className="mt-4">
            <AppStoreBadge onClick={() => trackAppStoreClick("step_1")} />
          </div>
        </section>

        <section aria-labelledby="step-2" className="mt-4 rounded-2xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 2</p>
          <h2 id="step-2" className="mt-1 text-xl font-semibold">
            Join the beta group
          </h2>

          {status === "done" ? (
            <div className="mt-4 space-y-4" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
                <p className="text-base">
                  You&apos;re in. I&apos;ll email you about next steps. If you haven&apos;t yet, download the app.
                </p>
              </div>
              <AppStoreBadge onClick={() => trackAppStoreClick("after_register")} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Use the same email you use in the app so I can match your account.
              </p>

              <Field id="fullName" label="Full name" error={errorFor("fullName")}>
                <Input id="fullName" name="fullName" autoComplete="name" required maxLength={120} className="h-11" />
              </Field>

              <Field id="email" label="Email you use in the app" error={errorFor("email")}>
                <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="h-11" />
              </Field>

              <Field id="linkedinUrl" label="LinkedIn profile (optional)" error={errorFor("linkedinUrl")}>
                <Input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.linkedin.com/in/..."
                  maxLength={300}
                  className="h-11"
                />
              </Field>

              <Field id="country" label="Country" error={errorFor("country")}>
                <Input id="country" name="country" autoComplete="country-name" required maxLength={80} className="h-11" />
              </Field>

              <YesNo
                name="hasIphone"
                legend="Do you have an iPhone?"
                value={hasIphone}
                error={errorFor("hasIphone")}
                onChange={setHasIphone}
              />

              <Field id="goal" label="What are you training for?" error={errorFor("goal")}>
                <select
                  id="goal"
                  name="goal"
                  required
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {GOAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              {goal === "race" ? (
                <Field id="raceDate" label="Race or target date (optional)" error={errorFor("raceDate")}>
                  <Input id="raceDate" name="raceDate" type="date" className="h-11" />
                </Field>
              ) : null}

              <YesNo
                name="returningAfterBreak"
                legend="Are you coming back after a break?"
                value={returningAfterBreak}
                error={errorFor("returningAfterBreak")}
                onChange={setReturningAfterBreak}
              />

              <Field id="runsPerWeekNow" label="How many times a week do you run now?" error={errorFor("runsPerWeekNow")}>
                <select id="runsPerWeekNow" name="runsPerWeekNow" required defaultValue="" className={selectClassName}>
                  <option value="" disabled>
                    Choose one
                  </option>
                  {RUNS_PER_WEEK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Honeypot: hidden from people, filled by bots. The name matches no autofill heuristic. */}
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="rs_hp_field">Leave this empty</label>
                <input id="rs_hp_field" name="rs_hp_field" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-start gap-3 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    aria-invalid={errorFor("consent") ? true : undefined}
                    aria-describedby={errorFor("consent") ? "consent-error" : undefined}
                    className="mt-1 h-5 w-5 shrink-0 accent-primary"
                  />
                  <span>
                    I agree RunSmart can store these answers and email me about the beta.{" "}
                    <Link href="/privacy" className="underline underline-offset-2">
                      Privacy policy
                    </Link>
                  </span>
                </label>
                {errorFor("consent") ? (
                  <p id="consent-error" className="text-sm text-destructive">
                    {errorFor("consent")}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={status === "submitting"}>
                {status === "submitting" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : null}
                Join the beta
              </Button>
            </form>
          )}
        </section>

        <section aria-labelledby="groups" className="mt-8 space-y-3">
          <h2 id="groups" className="text-xl font-semibold">
            What beta runners get
          </h2>
          <ul className="space-y-3">
            {GROUPS.map((group) => (
              <li key={group.name} className="rounded-xl border bg-card p-4">
                <p className="font-semibold">{group.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{group.text}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">Paid plans are not live yet. Nothing is charged today.</p>
        </section>

        <footer className="mt-10 flex gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </footer>
      </div>
    </main>
  );
}
