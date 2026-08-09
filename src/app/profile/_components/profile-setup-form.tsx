"use client";

import { useActionState, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fitnessGoalLabels,
  genderLabels,
  trainingExperienceLabels,
  trainingStyleLabels
} from "@/features/profile/types";
import { saveProfileAction } from "@/features/profile/actions";
import type { ProfileActionState } from "@/features/profile/server";
import { cn } from "@/lib/utils";

const initialState: ProfileActionState = { status: "idle" };

const steps = ["Welcome", "About you", "Fitness goals", "Finish"] as const;

const goalOptions = Object.entries(fitnessGoalLabels);
const experienceOptions = Object.entries(trainingExperienceLabels);
const styleOptions = Object.entries(trainingStyleLabels);
const genderOptions = Object.entries(genderLabels);
const avatarOutputSize = 320;
const maxAvatarFileSizeBytes = 5 * 1024 * 1024;

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  username: string;
  dateOfBirth: string;
  gender: string;
  genderSelfDescribe: string;
  heightCm: string;
  weightKg: string;
  mainFitnessGoal: string;
  trainingExperience: string;
  trainingFrequency: string;
  preferredStyle: string;
  targetWeightKg: string;
  bio: string;
}

function decimalValue(value: string | null | undefined) {
  return value ?? "";
}

function dateValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value;
}

function fieldError(errors: ProfileActionState["fieldErrors"], key: string) {
  return errors?.[key]?.[0];
}

export interface ProfileSetupData {
  profileImageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  genderSelfDescribe: string | null;
  heightCm: string | null;
  weightKg: string | null;
  mainFitnessGoal: string | null;
  trainingExperience: string | null;
  trainingFrequency: number | null;
  preferredStyle: string | null;
  targetWeightKg: string | null;
  bio: string | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface ProfileSetupFormProps {
  profile: ProfileSetupData | null;
  fallbackUser: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

export function ProfileSetupForm({ profile, fallbackUser }: ProfileSetupFormProps) {
  const [state, action] = useActionState(saveProfileAction, initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const user = profile?.user ?? fallbackUser;
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile?.profileImageUrl ?? user.image ?? "");
  const [croppedAvatarDataUrl, setCroppedAvatarDataUrl] = useState(
    profile?.profileImageUrl ?? user.image ?? ""
  );
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarAdjust, setAvatarAdjust] = useState({
    x: 50,
    y: 50,
    zoom: 1
  });
  const avatarObjectPosition = `${String(avatarAdjust.x)}% ${String(avatarAdjust.y)}%`;
  const avatarTransform = `scale(${String(avatarAdjust.zoom)})`;
  const [values, setValues] = useState<ProfileFormValues>({
    firstName: profile?.firstName ?? user.name?.split(" ")[0] ?? "",
    lastName: profile?.lastName ?? user.name?.split(" ").slice(1).join(" ") ?? "",
    username: profile?.username ?? user.name?.replace(/\s+/g, "").toLowerCase() ?? "",
    dateOfBirth: dateValue(profile?.dateOfBirth),
    gender: profile?.gender ?? "",
    genderSelfDescribe: profile?.genderSelfDescribe ?? "",
    heightCm: decimalValue(profile?.heightCm),
    weightKg: decimalValue(profile?.weightKg),
    mainFitnessGoal: profile?.mainFitnessGoal ?? "BUILD_MUSCLE",
    trainingExperience: profile?.trainingExperience ?? "BEGINNER",
    trainingFrequency: profile?.trainingFrequency ? String(profile.trainingFrequency) : "4",
    preferredStyle: profile?.preferredStyle ?? "HYPERTROPHY",
    targetWeightKg: decimalValue(profile?.targetWeightKg),
    bio: profile?.bio ?? ""
  });

  const summaryItems = useMemo(
    () => [
      ["Name", `${values.firstName} ${values.lastName}`.trim()],
      ["Display name", values.username],
      ["Goal", fitnessGoalLabels[values.mainFitnessGoal as keyof typeof fitnessGoalLabels]],
      [
        "Experience",
        trainingExperienceLabels[values.trainingExperience as keyof typeof trainingExperienceLabels]
      ],
      ["Frequency", `${values.trainingFrequency} days per week`],
      ["Height", `${values.heightCm} cm`],
      ["Weight", `${values.weightKg} kg`],
      ["Target", values.targetWeightKg ? `${values.targetWeightKg} kg` : "Not set"]
    ],
    [values]
  );

  function setField(name: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  useEffect(() => {
    if (!avatarDataUrl || avatarRemoved) {
      setCroppedAvatarDataUrl("");
      return;
    }

    if (!avatarDataUrl.startsWith("data:image/")) {
      setCroppedAvatarDataUrl(avatarDataUrl);
      return;
    }

    let isActive = true;
    const image = new Image();

    image.onload = () => {
      if (!isActive) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = avatarOutputSize;
      canvas.height = avatarOutputSize;

      const context = canvas.getContext("2d");

      if (!context) {
        setCroppedAvatarDataUrl(avatarDataUrl);
        return;
      }

      const visibleWidth =
        image.naturalWidth / Math.max(avatarAdjust.zoom, 1) >
        image.naturalHeight / Math.max(avatarAdjust.zoom, 1)
          ? image.naturalHeight / Math.max(avatarAdjust.zoom, 1)
          : image.naturalWidth / Math.max(avatarAdjust.zoom, 1);
      const visibleHeight = visibleWidth;
      const maxX = Math.max(0, image.naturalWidth - visibleWidth);
      const maxY = Math.max(0, image.naturalHeight - visibleHeight);
      const sourceX = maxX * (avatarAdjust.x / 100);
      const sourceY = maxY * (avatarAdjust.y / 100);

      context.drawImage(
        image,
        sourceX,
        sourceY,
        visibleWidth,
        visibleHeight,
        0,
        0,
        avatarOutputSize,
        avatarOutputSize
      );
      setCroppedAvatarDataUrl(canvas.toDataURL("image/webp", 0.9));
    };
    image.src = avatarDataUrl;

    return () => {
      isActive = false;
    };
  }, [avatarAdjust, avatarDataUrl, avatarRemoved]);

  function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Upload a PNG, JPG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > maxAvatarFileSizeBytes) {
      setAvatarError("Profile picture must be under 5 MB.");
      event.target.value = "";
      return;
    }

    setAvatarError("");
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDataUrl(typeof reader.result === "string" ? reader.result : "");
      setAvatarRemoved(false);
      setAvatarAdjust({ x: 50, y: 50, zoom: 1 });
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="profileImageDataUrl"
        value={avatarRemoved ? "__REMOVE__" : croppedAvatarDataUrl}
      />

      <div className="grid grid-cols-4 gap-2" aria-label="Profile setup progress">
        {steps.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => {
              setStepIndex(index);
            }}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-md border px-2 text-xs font-semibold transition-colors sm:text-sm",
              index <= stepIndex
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-white/10 bg-white/5 text-muted-foreground"
            )}
          >
            <span className="bg-current/10 grid size-6 place-items-center rounded-full">
              {index < stepIndex ? <Check className="size-3" aria-hidden="true" /> : index + 1}
            </span>
            <span className="hidden sm:inline">{step}</span>
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20 sm:p-6">
        {stepIndex === 0 ? (
          <div className="grid gap-5">
            <div>
              <p className="text-sm font-medium text-primary">Step 1</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">Welcome to Ascension</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Add the identity you want to see across your dashboard, training log, and progress
                views.
              </p>
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="grid gap-3">
                <div className="grid size-32 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-lg shadow-black/20">
                  {avatarDataUrl && !avatarRemoved ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarDataUrl}
                      alt=""
                      className="size-full object-cover"
                      style={{
                        objectPosition: avatarObjectPosition,
                        transform: avatarTransform
                      }}
                    />
                  ) : (
                    <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground">Profile preview</p>
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-medium transition-colors hover:bg-white/10">
                    <ImagePlus className="size-4" aria-hidden="true" />
                    Upload picture
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={onAvatarChange}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setAvatarDataUrl("");
                      setCroppedAvatarDataUrl("");
                      setAvatarRemoved(true);
                      setAvatarError("");
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
                {avatarDataUrl && !avatarRemoved ? (
                  <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-foreground">Adjust round frame</p>
                    <RangeField
                      label="Zoom"
                      min={1}
                      max={2.4}
                      step={0.05}
                      value={avatarAdjust.zoom}
                      onChange={(value) => {
                        setAvatarAdjust((current) => ({ ...current, zoom: value }));
                      }}
                    />
                    <RangeField
                      label="Horizontal"
                      min={0}
                      max={100}
                      step={1}
                      value={avatarAdjust.x}
                      onChange={(value) => {
                        setAvatarAdjust((current) => ({ ...current, x: value }));
                      }}
                    />
                    <RangeField
                      label="Vertical"
                      min={0}
                      max={100}
                      step={1}
                      value={avatarAdjust.y}
                      onChange={(value) => {
                        setAvatarAdjust((current) => ({ ...current, y: value }));
                      }}
                    />
                  </div>
                ) : null}
                {avatarError ? <p className="text-xs text-destructive">{avatarError}</p> : null}
                <p className="text-xs text-muted-foreground">PNG, JPG, or WebP under 5 MB.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="First name"
                name="firstName"
                value={values.firstName}
                error={fieldError(state.fieldErrors, "firstName")}
                onChange={setField}
                required
              />
              <TextField
                label="Last name"
                name="lastName"
                value={values.lastName}
                error={fieldError(state.fieldErrors, "lastName")}
                onChange={setField}
                required
              />
              <TextField
                label="Display name"
                name="username"
                value={values.username}
                error={fieldError(state.fieldErrors, "username")}
                onChange={setField}
                required
              />
            </div>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-5">
            <StepHeader
              step="Step 2"
              title="About you"
              copy="These details help Ascension keep progress and targets in the right context."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Date of birth"
                name="dateOfBirth"
                type="date"
                value={values.dateOfBirth}
                error={fieldError(state.fieldErrors, "dateOfBirth")}
                onChange={setField}
              />
              <SelectField
                label="Gender"
                name="gender"
                value={values.gender}
                error={fieldError(state.fieldErrors, "gender")}
                options={[["", "Optional"], ...genderOptions]}
                onChange={setField}
              />
              {values.gender === "SELF_DESCRIBE" ? (
                <TextField
                  label="Describe gender"
                  name="genderSelfDescribe"
                  value={values.genderSelfDescribe}
                  error={fieldError(state.fieldErrors, "genderSelfDescribe")}
                  onChange={setField}
                />
              ) : null}
              <TextField
                label="Height"
                name="heightCm"
                type="number"
                suffix="cm"
                value={values.heightCm}
                error={fieldError(state.fieldErrors, "heightCm")}
                onChange={setField}
                required
              />
              <TextField
                label="Weight"
                name="weightKg"
                type="number"
                suffix="kg"
                value={values.weightKg}
                error={fieldError(state.fieldErrors, "weightKg")}
                onChange={setField}
                required
              />
            </div>
            <TextArea
              label="Short bio"
              name="bio"
              value={values.bio}
              error={fieldError(state.fieldErrors, "bio")}
              onChange={setField}
            />
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="grid gap-5">
            <StepHeader
              step="Step 3"
              title="Fitness goals"
              copy="Set the training direction that should shape your dashboard and future recommendations."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Main fitness goal"
                name="mainFitnessGoal"
                value={values.mainFitnessGoal}
                error={fieldError(state.fieldErrors, "mainFitnessGoal")}
                options={goalOptions}
                onChange={setField}
              />
              <SelectField
                label="Training experience"
                name="trainingExperience"
                value={values.trainingExperience}
                error={fieldError(state.fieldErrors, "trainingExperience")}
                options={experienceOptions}
                onChange={setField}
              />
              <TextField
                label="Training frequency"
                name="trainingFrequency"
                type="number"
                suffix="days/week"
                value={values.trainingFrequency}
                error={fieldError(state.fieldErrors, "trainingFrequency")}
                onChange={setField}
                required
              />
              <SelectField
                label="Preferred style"
                name="preferredStyle"
                value={values.preferredStyle}
                error={fieldError(state.fieldErrors, "preferredStyle")}
                options={styleOptions}
                onChange={setField}
              />
              <TextField
                label="Target weight"
                name="targetWeightKg"
                type="number"
                suffix="kg"
                value={values.targetWeightKg}
                error={fieldError(state.fieldErrors, "targetWeightKg")}
                onChange={setField}
              />
            </div>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div className="grid gap-5">
            <StepHeader
              step="Step 4"
              title="Finish"
              copy="Review your setup before Ascension starts using it across your dashboard."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {summaryItems.map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {value === "" ? "Not set" : value}
                  </p>
                </div>
              ))}
            </div>
            {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={stepIndex === 0}
          onClick={() => {
            setStepIndex((current) => Math.max(0, current - 1));
          }}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        {stepIndex < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => {
              setStepIndex((current) => Math.min(steps.length - 1, current + 1));
            }}
          >
            Continue
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit">
            <Check className="size-4" aria-hidden="true" />
            Complete profile
          </Button>
        )}
      </div>
    </form>
  );
}

function StepHeader({ step, title, copy }: { step: string; title: string; copy: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">{step}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function RangeField({ label, min, max, step, value, onChange }: RangeFieldProps) {
  return (
    <label className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="w-full accent-primary"
      />
      <span className="text-xs tabular-nums text-muted-foreground">
        {label === "Zoom" ? `${value.toFixed(2)}x` : `${String(Math.round(value))}%`}
      </span>
    </label>
  );
}

interface FieldProps {
  label: string;
  name: keyof ProfileFormValues;
  value: string;
  error?: string | undefined;
  required?: boolean | undefined;
  type?: string | undefined;
  suffix?: string | undefined;
  onChange: (name: keyof ProfileFormValues, value: string) => void;
}

function TextField({
  label,
  name,
  value,
  error,
  required,
  type = "text",
  suffix,
  onChange
}: FieldProps) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <span className="flex items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.04] focus-within:ring-2 focus-within:ring-ring">
        <input
          name={name}
          type={type}
          step={type === "number" ? "0.1" : undefined}
          required={required}
          value={value}
          onChange={(event) => {
            onChange(name, event.target.value);
          }}
          className="min-h-11 w-full bg-transparent px-3 text-foreground outline-none"
        />
        {suffix ? <span className="px-3 text-xs text-muted-foreground">{suffix}</span> : null}
      </span>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  error,
  options,
  onChange
}: FieldProps & { options: [string, string][] }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        className="min-h-11 w-full rounded-md border border-white/10 bg-card px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue === "" ? "empty" : optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function TextArea({ label, name, value, error, onChange }: FieldProps) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        className="min-h-28 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
        maxLength={280}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
