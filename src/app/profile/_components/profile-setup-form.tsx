"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent
} from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Move, Trash2, X } from "lucide-react";

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
const cropDiameterRatio = 0.72;

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

interface ImageSize {
  width: number;
  height: number;
}

interface AvatarPosition {
  x: number;
  y: number;
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

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Image could not be loaded."));
    };
    image.src = sourceUrl;
  });
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
  const initialAvatarUrl = profile?.profileImageUrl ?? user.image ?? "";
  const [committedAvatarDataUrl, setCommittedAvatarDataUrl] = useState(initialAvatarUrl);
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState("");
  const [draftPreviewDataUrl, setDraftPreviewDataUrl] = useState("");
  const [draftImageSize, setDraftImageSize] = useState<ImageSize | null>(null);
  const [editorSize, setEditorSize] = useState(0);
  const [avatarPosition, setAvatarPosition] = useState<AvatarPosition>({ x: 0, y: 0 });
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    position: AvatarPosition;
  } | null>(null);
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

  const cropDiameter = editorSize * cropDiameterRatio;
  const baseImageScale =
    draftImageSize && cropDiameter > 0
      ? Math.max(cropDiameter / draftImageSize.width, cropDiameter / draftImageSize.height)
      : 1;
  const imageScale = baseImageScale * avatarZoom;
  const displayedImageSize = draftImageSize
    ? {
        width: draftImageSize.width * imageScale,
        height: draftImageSize.height * imageScale
      }
    : { width: 0, height: 0 };
  const constrainedAvatarPosition = useCallback(
    (position: AvatarPosition) => {
      if (!draftImageSize || editorSize <= 0 || cropDiameter <= 0) {
        return { x: 0, y: 0 };
      }

      const displayWidth = draftImageSize.width * imageScale;
      const displayHeight = draftImageSize.height * imageScale;
      const maxX = Math.max(0, (displayWidth - cropDiameter) / 2);
      const maxY = Math.max(0, (displayHeight - cropDiameter) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, position.x)),
        y: Math.min(maxY, Math.max(-maxY, position.y))
      };
    },
    [cropDiameter, draftImageSize, editorSize, imageScale]
  );

  const renderCircularCrop = useCallback(
    async (sourceUrl: string, outputType: "image/png" | "image/webp" = "image/png") => {
      if (!draftImageSize || editorSize <= 0 || cropDiameter <= 0) {
        return sourceUrl;
      }

      const image = await loadImage(sourceUrl);
      const constrainedPosition = constrainedAvatarPosition(avatarPosition);
      const cropLeft = (editorSize - cropDiameter) / 2;
      const cropTop = cropLeft;
      const imageLeft = editorSize / 2 - displayedImageSize.width / 2 + constrainedPosition.x;
      const imageTop = editorSize / 2 - displayedImageSize.height / 2 + constrainedPosition.y;
      const sourceX = (cropLeft - imageLeft) / imageScale;
      const sourceY = (cropTop - imageTop) / imageScale;
      const sourceSize = cropDiameter / imageScale;
      const canvas = document.createElement("canvas");
      canvas.width = avatarOutputSize;
      canvas.height = avatarOutputSize;

      const context = canvas.getContext("2d");

      if (!context) {
        return sourceUrl;
      }

      context.clearRect(0, 0, avatarOutputSize, avatarOutputSize);
      context.save();
      context.beginPath();
      context.arc(avatarOutputSize / 2, avatarOutputSize / 2, avatarOutputSize / 2, 0, Math.PI * 2);
      context.clip();
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        avatarOutputSize,
        avatarOutputSize
      );
      context.restore();

      return canvas.toDataURL(outputType, 0.92);
    },
    [
      avatarPosition,
      constrainedAvatarPosition,
      cropDiameter,
      displayedImageSize.height,
      displayedImageSize.width,
      draftImageSize,
      editorSize,
      imageScale
    ]
  );

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setEditorSize(entry.contentRect.width);
      }
    });

    observer.observe(editor);

    return () => {
      observer.disconnect();
    };
  }, [draftAvatarDataUrl]);

  useEffect(() => {
    if (!draftAvatarDataUrl) {
      return;
    }

    let isActive = true;
    loadImage(draftAvatarDataUrl)
      .then((image) => {
        if (!isActive) {
          return;
        }

        setDraftImageSize({ width: image.naturalWidth, height: image.naturalHeight });
        setAvatarPosition({ x: 0, y: 0 });
        setAvatarZoom(1);
      })
      .catch(() => {
        if (isActive) {
          setAvatarError("Unable to load that image. Try a different file.");
        }
      });

    return () => {
      isActive = false;
    };
  }, [draftAvatarDataUrl]);

  useEffect(() => {
    setAvatarPosition((current) => constrainedAvatarPosition(current));
  }, [constrainedAvatarPosition]);

  useEffect(() => {
    if (!draftAvatarDataUrl || !draftImageSize || editorSize <= 0) {
      setDraftPreviewDataUrl("");
      return;
    }

    let isActive = true;
    renderCircularCrop(draftAvatarDataUrl)
      .then((dataUrl) => {
        if (isActive) {
          setDraftPreviewDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isActive) {
          setDraftPreviewDataUrl("");
        }
      });

    return () => {
      isActive = false;
    };
  }, [draftAvatarDataUrl, draftImageSize, editorSize, renderCircularCrop]);

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
      setDraftAvatarDataUrl(typeof reader.result === "string" ? reader.result : "");
      setDraftPreviewDataUrl("");
      setDraftImageSize(null);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function cancelAvatarEdit() {
    setDraftAvatarDataUrl("");
    setDraftPreviewDataUrl("");
    setDraftImageSize(null);
    setAvatarPosition({ x: 0, y: 0 });
    setAvatarZoom(1);
    setAvatarError("");
  }

  async function applyAvatarEdit() {
    if (!draftAvatarDataUrl) {
      return;
    }

    try {
      const croppedDataUrl = await renderCircularCrop(draftAvatarDataUrl);
      setCommittedAvatarDataUrl(croppedDataUrl);
      setAvatarRemoved(false);
      cancelAvatarEdit();
    } catch {
      setAvatarError("Unable to crop that image. Try a different file.");
    }
  }

  function onAvatarPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!draftImageSize) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position: avatarPosition
    };
    setIsDraggingAvatar(true);
  }

  function onAvatarPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;

    if (dragStart?.pointerId !== event.pointerId) {
      return;
    }

    setAvatarPosition(
      constrainedAvatarPosition({
        x: dragStart.position.x + event.clientX - dragStart.clientX,
        y: dragStart.position.y + event.clientY - dragStart.clientY
      })
    );
  }

  function onAvatarPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;

    if (dragStart?.pointerId !== event.pointerId) {
      return;
    }

    dragStartRef.current = null;
    setIsDraggingAvatar(false);
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="profileImageDataUrl"
        value={avatarRemoved ? "__REMOVE__" : committedAvatarDataUrl}
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
                  {committedAvatarDataUrl && !avatarRemoved ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={committedAvatarDataUrl} alt="" className="size-full object-cover" />
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
                      cancelAvatarEdit();
                      setCommittedAvatarDataUrl("");
                      setAvatarRemoved(true);
                      setAvatarError("");
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
                {draftAvatarDataUrl ? (
                  <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Adjust round frame</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Drag the image, then apply the crop when it looks right.
                        </p>
                      </div>
                      <Move
                        className={cn(
                          "size-5 text-muted-foreground transition-colors",
                          isDraggingAvatar ? "text-primary" : null
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div
                        ref={editorRef}
                        className={cn(
                          "relative aspect-square w-full max-w-sm touch-none select-none overflow-hidden rounded-lg border border-white/10 bg-black/40",
                          isDraggingAvatar ? "cursor-grabbing" : "cursor-grab"
                        )}
                        onPointerDown={onAvatarPointerDown}
                        onPointerMove={onAvatarPointerMove}
                        onPointerUp={onAvatarPointerEnd}
                        onPointerCancel={onAvatarPointerEnd}
                      >
                        {draftImageSize ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={draftAvatarDataUrl}
                            alt=""
                            draggable={false}
                            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                            style={{
                              width: `${String(displayedImageSize.width)}px`,
                              height: `${String(displayedImageSize.height)}px`,
                              transform: `translate(calc(-50% + ${String(avatarPosition.x)}px), calc(-50% + ${String(avatarPosition.y)}px))`
                            }}
                          />
                        ) : null}
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: `radial-gradient(circle at center, transparent 0 ${String(
                              cropDiameter / 2
                            )}px, rgba(0,0,0,0.62) ${String(cropDiameter / 2 + 1)}px 100%)`
                          }}
                        />
                        <div
                          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-primary shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_28px_rgba(156,238,58,0.20)]"
                          style={{
                            width: `${String(cropDiameter)}px`,
                            height: `${String(cropDiameter)}px`,
                            transform: "translate(-50%, -50%)"
                          }}
                        />
                      </div>
                      <div className="grid justify-items-start gap-2 lg:justify-items-center">
                        <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-lg shadow-black/20">
                          {draftPreviewDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={draftPreviewDataUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImagePlus
                              className="size-6 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Final preview</p>
                      </div>
                    </div>
                    <RangeField
                      label="Zoom"
                      min={1}
                      max={2.4}
                      step={0.05}
                      value={avatarZoom}
                      onChange={(value) => {
                        setAvatarZoom(value);
                      }}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" onClick={cancelAvatarEdit}>
                        <X className="size-4" aria-hidden="true" />
                        Cancel
                      </Button>
                      <Button type="button" onClick={applyAvatarEdit}>
                        <Check className="size-4" aria-hidden="true" />
                        Apply
                      </Button>
                    </div>
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
