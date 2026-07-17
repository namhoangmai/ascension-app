"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Dumbbell,
  FileDown,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Utensils
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_AI_PROFILE,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  WORKOUT_SPLITS,
  answerCoachQuestion,
  buildAiCoachContext,
  generateInsights,
  generateMealPlan,
  generateWeeklyReport,
  generateWorkoutPlan,
  loadAiProfile,
  saveAiProfile
} from "@/features/ai/client-store";
import { cn } from "@/lib/utils";
import type { AiCoachProfile } from "@/types/ai-coach";

type CoachTab = "summary" | "meal" | "workout" | "report" | "chat" | "profile";

interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
}

const GOALS: AiCoachProfile["fitnessGoal"][] = [
  "Build Muscle",
  "Lose Fat",
  "Maintain Weight",
  "Recomposition",
  "Improve Strength",
  "Improve Endurance"
];

const ACTIVITIES: AiCoachProfile["activityLevel"][] = [
  "Sedentary",
  "Light",
  "Moderate",
  "Very Active",
  "Athlete"
];

const EXPERIENCE: AiCoachProfile["experience"][] = ["Beginner", "Intermediate", "Advanced"];

export function AiCoachClient() {
  const [activeTab, setActiveTab] = useState<CoachTab>("summary");
  const [profile, setProfile] = useState<AiCoachProfile>(DEFAULT_AI_PROFILE);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "coach",
      content:
        "Ask me about strength progress, tomorrow's meals, weight trends, or a training plan. I will only use data sources enabled in your AI profile."
    }
  ]);

  useEffect(() => {
    setProfile(loadAiProfile());
  }, []);

  const context = useMemo(() => buildAiCoachContext(profile), [profile]);
  const insights = useMemo(() => generateInsights(profile, context), [profile, context]);
  const mealPlan = useMemo(() => generateMealPlan(profile, context), [profile, context]);
  const workoutPlan = useMemo(() => generateWorkoutPlan(profile, context), [profile, context]);
  const weeklyReport = useMemo(() => generateWeeklyReport(profile, context), [profile, context]);

  function updateProfile(nextProfile: AiCoachProfile) {
    setProfile(nextProfile);
    saveAiProfile(nextProfile);
  }

  function sendMessage() {
    const question = chatInput.trim();

    if (!question) {
      return;
    }

    const answer = answerCoachQuestion(question, profile, context);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now().toString()}`, role: "user", content: question },
      { id: `coach-${Date.now().toString()}`, role: "coach", content: answer }
    ]);
    setChatInput("");
  }

  function exportReport() {
    const reportText = [
      "Ascension AI Weekly Report",
      "",
      `Training: ${weeklyReport.trainingConsistency}`,
      `Nutrition: ${weeklyReport.nutritionConsistency}`,
      `Weight: ${weeklyReport.weightChanges}`,
      `Measurements: ${weeklyReport.measurementChanges}`,
      `Strength: ${weeklyReport.strengthImprovements}`,
      `PRs: ${weeklyReport.personalRecords}`,
      `Recovery: ${weeklyReport.recoveryObservations}`,
      "",
      "Suggested adjustments:",
      ...weeklyReport.suggestedAdjustments.map((adjustment) => `- ${adjustment}`)
    ].join("\n");

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ascension-ai-weekly-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Personal Coach</p>
          <h1 className="text-3xl font-semibold tracking-normal">AI Coach</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Data-aware coaching across strength, macros, body progress, and journal reflections.
            Recommendations explain the evidence they used.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1 sm:flex">
          {[
            ["summary", "Summary"],
            ["meal", "Meals"],
            ["workout", "Workout"],
            ["report", "Report"],
            ["chat", "Chat"],
            ["profile", "Profile"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setActiveTab(value as CoachTab);
              }}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
                activeTab === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-white/8 text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "summary" ? (
        <SummaryTab context={context} insights={insights} profile={profile} />
      ) : null}

      {activeTab === "meal" ? (
        <MealTab
          mealPlan={mealPlan}
          onRegenerate={() => {
            setProfile({ ...profile });
          }}
        />
      ) : null}

      {activeTab === "workout" ? <WorkoutTab workoutPlan={workoutPlan} /> : null}

      {activeTab === "report" ? <ReportTab report={weeklyReport} onExport={exportReport} /> : null}

      {activeTab === "chat" ? (
        <ChatTab
          messages={messages}
          value={chatInput}
          onChange={setChatInput}
          onSend={sendMessage}
        />
      ) : null}

      {activeTab === "profile" ? <ProfileTab profile={profile} onChange={updateProfile} /> : null}
    </div>
  );
}

function SummaryTab({
  context,
  insights,
  profile
}: {
  context: ReturnType<typeof buildAiCoachContext>;
  insights: ReturnType<typeof generateInsights>;
  profile: AiCoachProfile;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CoachMetric
          icon={Activity}
          label="Daily Summary"
          value={context.currentWeight ? `${context.currentWeight.toFixed(1)} kg` : "No weight"}
          helper={`Goal: ${profile.fitnessGoal}`}
        />
        <CoachMetric
          icon={Utensils}
          label="Nutrition"
          value={
            context.proteinAverage === null
              ? "Log meals"
              : `${context.proteinAverage.toFixed(0)}g protein`
          }
          helper={
            context.proteinTarget === null
              ? "No target found"
              : `${context.proteinTarget.toFixed(0)}g target`
          }
        />
        <CoachMetric
          icon={Dumbbell}
          label="Workout"
          value={`${String(context.workoutCount)} sessions`}
          helper={context.strongestLift ?? "Log workouts for PRs"}
        />
        <CoachMetric
          icon={Sparkles}
          label="Recovery"
          value={context.latestJournal ? "Journal active" : "No notes"}
          helper="Reflections improve coaching quality"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {insights.map((insight) => (
          <article key={insight.title} className="rounded-lg border border-white/10 bg-card/90 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold tracking-normal">{insight.title}</h2>
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium",
                  insight.priority === "high"
                    ? "bg-destructive/20 text-destructive"
                    : insight.priority === "medium"
                      ? "bg-primary/15 text-primary"
                      : "bg-white/[0.06] text-muted-foreground"
                )}
              >
                {insight.priority}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{insight.body}</p>
            <p className="mt-3 rounded-md bg-white/[0.05] p-3 text-xs text-muted-foreground">
              Why: {insight.evidence}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function MealTab({
  mealPlan,
  onRegenerate
}: {
  mealPlan: ReturnType<typeof generateMealPlan>;
  onRegenerate: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-card/90 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">AI Meal Plan</h2>
          <p className="text-sm text-muted-foreground">
            {String(mealPlan.calories)} kcal - {String(mealPlan.protein)}g protein -{" "}
            {String(mealPlan.carbs)}g carbs - {String(mealPlan.fat)}g fat
          </p>
        </div>
        <Button variant="outline" onClick={onRegenerate}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerate
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {mealPlan.meals.map((meal) => (
          <article key={meal.name} className="rounded-lg border border-white/10 bg-card/90 p-4">
            <h3 className="font-semibold">{meal.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {String(meal.calories)} kcal - P {String(meal.protein)} / C {String(meal.carbs)} / F{" "}
              {String(meal.fat)}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {meal.foods.map((food) => (
                <li key={food}>{food}</li>
              ))}
            </ul>
            <p className="mt-3 rounded-md bg-white/[0.05] p-3 text-sm text-muted-foreground">
              {meal.preparation}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CoachPanel title="Shopping List">{mealPlan.shoppingList.join(", ")}</CoachPanel>
        <CoachPanel title="Meal Prep">{mealPlan.mealPrepSuggestions.join(" ")}</CoachPanel>
      </div>
      <CoachPanel title="Why This Plan">{mealPlan.rationale}</CoachPanel>
    </section>
  );
}

function WorkoutTab({ workoutPlan }: { workoutPlan: ReturnType<typeof generateWorkoutPlan> }) {
  return (
    <section className="space-y-4">
      <CoachPanel title="Workout Recommendation">{workoutPlan.rationale}</CoachPanel>
      <div className="grid gap-3 lg:grid-cols-2">
        {workoutPlan.schedule.map((day) => (
          <article key={day.day} className="rounded-lg border border-white/10 bg-card/90 p-4">
            <p className="text-sm text-primary">{day.day}</p>
            <h2 className="text-lg font-semibold tracking-normal">{day.focus}</h2>
            <div className="mt-3 space-y-2">
              {day.exercises.map((exercise) => (
                <div key={exercise.name} className="rounded-md bg-white/[0.05] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{exercise.name}</span>
                    <span className="text-muted-foreground">
                      {String(exercise.sets)} x {exercise.reps}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Rest {String(exercise.restSeconds)}s - {exercise.intensity}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <CoachPanel title="Warm-up">{workoutPlan.warmup.join(" - ")}</CoachPanel>
        <CoachPanel title="Progression">{workoutPlan.progressionStrategy}</CoachPanel>
        <CoachPanel title="Deload">{workoutPlan.deloadRecommendation}</CoachPanel>
      </div>
    </section>
  );
}

function ReportTab({
  report,
  onExport
}: {
  report: ReturnType<typeof generateWeeklyReport>;
  onExport: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onExport}>
          <FileDown className="size-4" aria-hidden="true" />
          Export Report
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CoachPanel title="Training Consistency">{report.trainingConsistency}</CoachPanel>
        <CoachPanel title="Nutrition Consistency">{report.nutritionConsistency}</CoachPanel>
        <CoachPanel title="Weight Changes">{report.weightChanges}</CoachPanel>
        <CoachPanel title="Measurement Changes">{report.measurementChanges}</CoachPanel>
        <CoachPanel title="Strength Improvements">{report.strengthImprovements}</CoachPanel>
        <CoachPanel title="Recovery">{report.recoveryObservations}</CoachPanel>
      </div>
      <CoachPanel title="Next Week Adjustments">{report.suggestedAdjustments.join(" ")}</CoachPanel>
    </section>
  );
}

function ChatTab({
  messages,
  value,
  onChange,
  onSend
}: {
  messages: ChatMessage[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-card/90 p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold tracking-normal">AI Chat</h2>
      </div>
      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg p-3 text-sm",
              message.role === "user"
                ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                : "mr-auto max-w-[90%] bg-white/[0.06] text-foreground"
            )}
          >
            {message.content}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSend();
            }
          }}
          placeholder="Ask: Why isn't my weight changing?"
          className="h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 text-sm outline-none focus:border-primary/70"
        />
        <Button size="icon" onClick={onSend} aria-label="Send message">
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function ProfileTab({
  profile,
  onChange
}: {
  profile: AiCoachProfile;
  onChange: (profile: AiCoachProfile) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-white/10 bg-card/90 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          label="Age"
          value={profile.age}
          onChange={(age) => {
            onChange({ ...profile, age });
          }}
        />
        <NumberField
          label="Height"
          suffix="cm"
          value={profile.heightCm}
          onChange={(heightCm) => {
            onChange({ ...profile, heightCm });
          }}
        />
        <SelectField
          label="Sex"
          value={profile.sex}
          onChange={(sex) => {
            onChange({ ...profile, sex: sex as AiCoachProfile["sex"] });
          }}
          options={["", "Female", "Male", "Other"]}
        />
        <SelectField
          label="Goal"
          value={profile.fitnessGoal}
          onChange={(fitnessGoal) => {
            onChange({ ...profile, fitnessGoal: fitnessGoal as AiCoachProfile["fitnessGoal"] });
          }}
          options={GOALS}
        />
        <SelectField
          label="Activity Level"
          value={profile.activityLevel}
          onChange={(activityLevel) => {
            onChange({
              ...profile,
              activityLevel: activityLevel as AiCoachProfile["activityLevel"]
            });
          }}
          options={ACTIVITIES}
        />
        <SelectField
          label="Experience"
          value={profile.experience}
          onChange={(experience) => {
            onChange({ ...profile, experience: experience as AiCoachProfile["experience"] });
          }}
          options={EXPERIENCE}
        />
        <NumberField
          label="Training Frequency"
          value={profile.trainingFrequency}
          onChange={(trainingFrequency) => {
            onChange({ ...profile, trainingFrequency: trainingFrequency ?? 4 });
          }}
        />
        <NumberField
          label="Meal Frequency"
          value={profile.mealFrequency}
          onChange={(mealFrequency) => {
            onChange({ ...profile, mealFrequency: mealFrequency ?? 4 });
          }}
        />
        <NumberField
          label="Cooking Time"
          suffix="min"
          value={profile.cookingTimeMinutes}
          onChange={(cookingTimeMinutes) => {
            onChange({ ...profile, cookingTimeMinutes: cookingTimeMinutes ?? 30 });
          }}
        />
      </div>

      <PreferenceGroup
        title="Dietary Preferences"
        options={DIET_OPTIONS}
        values={profile.dietaryPreferences}
        onChange={(dietaryPreferences) => {
          onChange({ ...profile, dietaryPreferences });
        }}
      />
      <PreferenceGroup
        title="Workout Preferences"
        options={WORKOUT_SPLITS}
        values={profile.workoutPreferences}
        onChange={(workoutPreferences) => {
          onChange({ ...profile, workoutPreferences });
        }}
      />
      <PreferenceGroup
        title="Available Equipment"
        options={EQUIPMENT_OPTIONS}
        values={profile.availableEquipment}
        onChange={(availableEquipment) => {
          onChange({ ...profile, availableEquipment });
        }}
      />

      <section className="grid gap-3 rounded-lg border border-white/10 bg-card/90 p-4 md:grid-cols-2">
        {Object.entries(profile.dataPermissions).map(([key, enabled]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 rounded-md bg-white/[0.05] px-3 py-2"
          >
            <span className="capitalize">{key} data access</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                onChange({
                  ...profile,
                  dataPermissions: {
                    ...profile.dataPermissions,
                    [key]: event.target.checked
                  }
                });
              }}
              className="size-4 accent-primary"
            />
          </label>
        ))}
      </section>

      <Button
        onClick={() => {
          onChange(profile);
        }}
      >
        <Save className="size-4" aria-hidden="true" />
        Profile Saved
      </Button>
    </section>
  );
}

function CoachMetric({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-card/90 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function CoachPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-white/10 bg-card/90 p-4">
      <h2 className="font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </article>
  );
}

function PreferenceGroup({
  title,
  options,
  values,
  onChange
}: {
  title: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-card/90 p-4">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-primary" aria-hidden="true" />
        <h2 className="font-semibold tracking-normal">{title}</h2>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(
                  selected ? values.filter((value) => value !== option) : [...values, option]
                );
              }}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex h-11 items-center rounded-md border border-white/10 bg-white/[0.05] focus-within:border-primary/70">
        <input
          type="number"
          value={value ?? ""}
          onChange={(event) => {
            onChange(event.target.value === "" ? null : Number(event.target.value));
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
        {suffix ? <span className="px-3 text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-11 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 text-sm outline-none focus:border-primary/70"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}
