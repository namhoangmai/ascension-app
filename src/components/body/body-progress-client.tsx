"use client";

import {
  Camera,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Lock,
  Plus,
  Save,
  Scale,
  Shield,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  BODY_CHECK_IN_DRAFT_STORAGE_KEY,
  BODY_JOURNAL_DRAFT_STORAGE_KEY,
  BODY_MEASUREMENT_FIELDS,
  BODY_MOODS,
  BODY_PROGRESS_RANGES,
  createEmptyCheckIn,
  createEmptyJournalEntry,
  createEncryptedProgressPhoto,
  decryptProgressPhoto,
  filterBodyTrend,
  formatBodyDate,
  formatMeasurementValue,
  getBodyProgressStats,
  getBodyTrendPoints,
  loadBodyCheckIns,
  loadJournalEntries,
  loadProgressPhotos,
  saveBodyCheckIns,
  saveJournalEntries,
  saveProgressPhotos,
  sortCheckIns,
  sortJournalEntries
} from "@/features/body/client-store";
import { cn } from "@/lib/utils";
import type {
  BodyCheckIn,
  BodyMeasurementKey,
  BodyMood,
  BodyPhotoCategory,
  BodyProgressRange,
  BodyProgressTab,
  JournalEntry,
  ProgressPhoto
} from "@/types/body-progress";

const PHOTO_CATEGORIES: BodyPhotoCategory[] = [
  "Front",
  "Back",
  "Left Side",
  "Right Side",
  "Custom"
];
const DEFAULT_MEASUREMENT_CHARTS: BodyMeasurementKey[] = [
  "chest",
  "waist",
  "shoulders",
  "leftArm",
  "leftThigh"
];

export function BodyProgressClient() {
  const [activeTab, setActiveTab] = useState<BodyProgressTab>("overview");
  const [checkIns, setCheckIns] = useState<BodyCheckIn[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [checkInDraft, setCheckInDraft] = useState<BodyCheckIn | null>(null);
  const [journalDraft, setJournalDraft] = useState<JournalEntry | null>(null);
  const [range, setRange] = useState<BodyProgressRange>("3M");
  const [revealedPhotos, setRevealedPhotos] = useState<Record<string, string>>({});
  const [galleryCheckInId, setGalleryCheckInId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<{ left: string; right: string }>({
    left: "",
    right: ""
  });
  const [selectedMeasurements, setSelectedMeasurements] = useState<BodyMeasurementKey[]>(
    DEFAULT_MEASUREMENT_CHARTS
  );

  useEffect(() => {
    const storedCheckIns = loadBodyCheckIns();
    const storedPhotos = loadProgressPhotos();
    const storedJournals = loadJournalEntries();

    setCheckIns(storedCheckIns);
    setPhotos(storedPhotos);
    setJournals(storedJournals);

    const sorted = sortCheckIns(storedCheckIns);
    setCompareIds({ left: sorted[1]?.id ?? sorted[0]?.id ?? "", right: sorted[0]?.id ?? "" });

    const rawCheckInDraft = localStorage.getItem(BODY_CHECK_IN_DRAFT_STORAGE_KEY);
    const rawJournalDraft = localStorage.getItem(BODY_JOURNAL_DRAFT_STORAGE_KEY);

    if (rawCheckInDraft) {
      setCheckInDraft(JSON.parse(rawCheckInDraft) as BodyCheckIn);
    }

    if (rawJournalDraft) {
      setJournalDraft(JSON.parse(rawJournalDraft) as JournalEntry);
    }
  }, []);

  useEffect(() => {
    if (checkInDraft) {
      localStorage.setItem(BODY_CHECK_IN_DRAFT_STORAGE_KEY, JSON.stringify(checkInDraft));
    }
  }, [checkInDraft]);

  useEffect(() => {
    if (journalDraft) {
      localStorage.setItem(BODY_JOURNAL_DRAFT_STORAGE_KEY, JSON.stringify(journalDraft));
    }
  }, [journalDraft]);

  const sortedCheckIns = useMemo(() => sortCheckIns(checkIns), [checkIns]);
  const sortedJournals = useMemo(() => sortJournalEntries(journals), [journals]);
  const latestCheckIn = sortedCheckIns[0];
  const latestJournal = sortedJournals[0];
  const trendPoints = useMemo(
    () => filterBodyTrend(getBodyTrendPoints(checkIns), range),
    [checkIns, range]
  );
  const stats = useMemo(
    () => getBodyProgressStats(checkIns, photos, journals),
    [checkIns, photos, journals]
  );

  function persistCheckIns(nextCheckIns: BodyCheckIn[]) {
    setCheckIns(nextCheckIns);
    saveBodyCheckIns(nextCheckIns);
  }

  function persistPhotos(nextPhotos: ProgressPhoto[]) {
    setPhotos(nextPhotos);
    saveProgressPhotos(nextPhotos);
  }

  function persistJournals(nextJournals: JournalEntry[]) {
    setJournals(nextJournals);
    saveJournalEntries(nextJournals);
  }

  function saveCheckInDraft() {
    if (!checkInDraft) {
      return;
    }

    const linkedJournal: JournalEntry | null =
      checkInDraft.notes?.trim() || checkInDraft.mood
        ? {
            ...createEmptyJournalEntry(checkInDraft.id),
            title: `Check-in Reflection - ${formatBodyDate(checkInDraft.date)}`,
            date: checkInDraft.date,
            mood: checkInDraft.mood ?? "",
            content: checkInDraft.notes ?? "",
            linkedCheckInId: checkInDraft.id,
            updatedAt: Date.now()
          }
        : null;

    const savedCheckIn: BodyCheckIn = {
      ...checkInDraft,
      ...(linkedJournal ? { journalId: linkedJournal.id } : {}),
      updatedAt: Date.now()
    };

    persistCheckIns([
      savedCheckIn,
      ...checkIns.filter((checkIn) => checkIn.id !== savedCheckIn.id)
    ]);

    if (linkedJournal) {
      persistJournals([
        linkedJournal,
        ...journals.filter((entry) => entry.id !== linkedJournal.id)
      ]);
    }

    localStorage.removeItem(BODY_CHECK_IN_DRAFT_STORAGE_KEY);
    setCheckInDraft(null);
    setActiveTab("overview");
  }

  function saveJournalDraft() {
    if (!journalDraft) {
      return;
    }

    const savedJournal = {
      ...journalDraft,
      title: journalDraft.title.trim() || "Untitled Journal",
      updatedAt: Date.now()
    };

    persistJournals([savedJournal, ...journals.filter((entry) => entry.id !== savedJournal.id)]);
    localStorage.removeItem(BODY_JOURNAL_DRAFT_STORAGE_KEY);
    setJournalDraft(null);
    setActiveTab("journal");
  }

  async function revealPhoto(photo: ProgressPhoto) {
    if (revealedPhotos[photo.id]) {
      return;
    }

    const dataUrl = await decryptProgressPhoto(photo);
    setRevealedPhotos((current) => ({ ...current, [photo.id]: dataUrl }));
  }

  const photosByCheckIn = useMemo(
    () =>
      sortedCheckIns.map((checkIn) => ({
        checkIn,
        photos: photos.filter((photo) => photo.checkInId === checkIn.id)
      })),
    [photos, sortedCheckIns]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Private Progress</p>
          <h1 className="text-title font-semibold">Body Progress</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Track weight, measurements, photos, and journal notes in one private progress timeline.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1 sm:flex">
          {[
            ["overview", "Overview"],
            ["checkins", "Check-ins"],
            ["photos", "Progress Photos"],
            ["journal", "Journal"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setActiveTab(value as BodyProgressTab);
              }}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
                activeTab === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "overview" ? (
        <OverviewTab
          stats={stats}
          range={range}
          onRangeChange={setRange}
          trendPoints={trendPoints}
          latestCheckIn={latestCheckIn}
          latestJournal={latestJournal}
          latestPhotos={photosByCheckIn.find((entry) => entry.photos.length > 0)?.photos ?? []}
          revealedPhotos={revealedPhotos}
          onRevealPhoto={revealPhoto}
          selectedMeasurements={selectedMeasurements}
          onToggleMeasurement={(measurement) => {
            setSelectedMeasurements((current) =>
              current.includes(measurement)
                ? current.filter((item) => item !== measurement)
                : [...current, measurement]
            );
          }}
        />
      ) : null}

      {activeTab === "checkins" ? (
        <CheckInsTab
          checkIns={sortedCheckIns}
          onNew={() => {
            setCheckInDraft(createEmptyCheckIn());
          }}
          onDelete={(checkInId) => {
            persistCheckIns(checkIns.filter((checkIn) => checkIn.id !== checkInId));
            persistPhotos(photos.filter((photo) => photo.checkInId !== checkInId));
          }}
        />
      ) : null}

      {activeTab === "photos" ? (
        <PhotosTab
          photosByCheckIn={photosByCheckIn}
          checkIns={sortedCheckIns}
          compareIds={compareIds}
          onCompareChange={setCompareIds}
          galleryCheckInId={galleryCheckInId}
          onOpenGallery={setGalleryCheckInId}
          onCloseGallery={() => {
            setGalleryCheckInId(null);
          }}
          revealedPhotos={revealedPhotos}
          onRevealPhoto={revealPhoto}
        />
      ) : null}

      {activeTab === "journal" ? (
        <JournalTab
          entries={sortedJournals}
          onNew={() => {
            setJournalDraft(createEmptyJournalEntry());
          }}
          onWorkoutReflection={() => {
            setJournalDraft({
              ...createEmptyJournalEntry(),
              title: "Workout Reflection",
              content:
                "Workout completed.\n\nHow it felt:\nEnergy:\nMotivation:\nRecovery:\nTechnique improvements:\nWhat went well:\nWhat to improve next session:",
              workoutSummary: {
                name: "Upper Body",
                duration: "Completed today",
                exercises: ["Bench Press", "Incline DB Press", "Cable Fly"]
              }
            });
          }}
          onDelete={(entryId) => {
            persistJournals(journals.filter((entry) => entry.id !== entryId));
          }}
        />
      ) : null}

      <Button
        className="fixed bottom-24 right-5 z-30 size-16 rounded-full shadow-glow md:bottom-8 md:right-8"
        size="icon"
        aria-label="Add body progress"
        onClick={() => {
          if (activeTab === "journal") {
            setJournalDraft(createEmptyJournalEntry());
            return;
          }

          setCheckInDraft(createEmptyCheckIn());
        }}
      >
        <Plus className="size-8" aria-hidden="true" />
      </Button>

      <AnimatePresence>
        {checkInDraft ? (
          <CheckInEditor
            key={checkInDraft.id}
            draft={checkInDraft}
            photos={photos}
            revealedPhotos={revealedPhotos}
            onRevealPhoto={revealPhoto}
            onChange={setCheckInDraft}
            onPhotosChange={persistPhotos}
            onClose={() => {
              setCheckInDraft(null);
            }}
            onSave={saveCheckInDraft}
          />
        ) : null}

        {journalDraft ? (
          <JournalEditor
            key={journalDraft.id}
            draft={journalDraft}
            onChange={setJournalDraft}
            onClose={() => {
              setJournalDraft(null);
            }}
            onSave={saveJournalDraft}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function OverviewTab({
  stats,
  range,
  onRangeChange,
  trendPoints,
  latestCheckIn,
  latestJournal,
  latestPhotos,
  revealedPhotos,
  onRevealPhoto,
  selectedMeasurements,
  onToggleMeasurement
}: {
  stats: ReturnType<typeof getBodyProgressStats>;
  range: BodyProgressRange;
  onRangeChange: (range: BodyProgressRange) => void;
  trendPoints: ReturnType<typeof getBodyTrendPoints>;
  latestCheckIn: BodyCheckIn | undefined;
  latestJournal: JournalEntry | undefined;
  latestPhotos: ProgressPhoto[];
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
  selectedMeasurements: BodyMeasurementKey[];
  onToggleMeasurement: (measurement: BodyMeasurementKey) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Scale}
          label="Current Weight"
          value={stats.currentWeight === null ? "-" : `${stats.currentWeight.toFixed(1)} kg`}
          helper={
            stats.monthlyChange === null
              ? "No monthly trend yet"
              : `${formatDelta(stats.monthlyChange)} this month`
          }
        />
        <MetricCard
          icon={Sparkles}
          label="Total Change"
          value={stats.totalChange === null ? "-" : `${formatDelta(stats.totalChange)} kg`}
          helper="Since first check-in"
        />
        <MetricCard
          icon={Check}
          label="Total Check-ins"
          value={String(stats.totalCheckIns)}
          helper={`${String(stats.longestCheckInStreak)} day best streak`}
        />
        <MetricCard
          icon={Camera}
          label="Progress Photos"
          value={String(stats.photoCount)}
          helper="Encrypted locally"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/90 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-normal">Weight Trend</h2>
          <RangePicker range={range} onChange={onRangeChange} />
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendPoints} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                width={44}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--foreground))"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="bodyFat"
                stroke="hsl(var(--foreground) / 0.6)"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {selectedMeasurements.map((measurement, index) => (
                <Line
                  key={measurement}
                  type="monotone"
                  dataKey={measurement}
                  stroke={`hsl(var(--foreground) / ${String([0.45, 0.35, 0.5, 0.3, 0.4][index % 5] ?? 0.4)})`}
                  strokeDasharray={["2 3", "8 3 2 3", "1 4", "10 4", "4 2"][index % 5]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {BODY_MEASUREMENT_FIELDS.filter((field) =>
            DEFAULT_MEASUREMENT_CHARTS.includes(field.key)
          ).map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => {
                onToggleMeasurement(field.key);
              }}
              className={cn(
                "press rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                selectedMeasurements.includes(field.key)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {field.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-border bg-card/90 p-4">
          <h2 className="text-lg font-semibold tracking-normal">Latest Measurements</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {BODY_MEASUREMENT_FIELDS.filter(
              (field) => latestCheckIn?.measurements[field.key] !== undefined
            )
              .slice(0, 8)
              .map((field) => (
                <div
                  key={field.key}
                  className="flex justify-between rounded-md bg-muted px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-medium">
                    {formatMeasurementValue(latestCheckIn?.measurements[field.key])}
                  </span>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/90 p-4">
          <h2 className="text-lg font-semibold tracking-normal">Latest Journal</h2>
          {latestJournal ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                {formatBodyDate(latestJournal.date, true)}
              </p>
              <h3 className="mt-1 font-semibold">{latestJournal.title}</h3>
              <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-muted-foreground">
                {latestJournal.content}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No journal entries yet.</p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card/90 p-4">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold tracking-normal">Latest Photos</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Blurred until tapped. Stored as encrypted local data, not public URLs.
        </p>
        <PhotoStrip
          photos={latestPhotos.slice(0, 4)}
          revealedPhotos={revealedPhotos}
          onRevealPhoto={onRevealPhoto}
        />
      </section>
    </div>
  );
}

function CheckInsTab({
  checkIns,
  onNew,
  onDelete
}: {
  checkIns: BodyCheckIn[];
  onNew: () => void;
  onDelete: (checkInId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onNew}>
          <Plus className="size-4" aria-hidden="true" />
          New Check-in
        </Button>
      </div>
      <div className="space-y-3">
        {checkIns.map((checkIn) => (
          <article
            key={checkIn.id}
            className="hover-lift animate-rise-in rounded-2xl border border-border bg-card/90 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{checkIn.time}</p>
                <h2 className="text-xl font-semibold tracking-normal">
                  {formatBodyDate(checkIn.date, true)}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onDelete(checkIn.id);
                }}
                aria-label="Delete check-in"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SmallStat
                label="Weight"
                value={checkIn.weight === null ? "-" : `${checkIn.weight.toFixed(1)} kg`}
              />
              <SmallStat
                label="Body Fat"
                value={
                  checkIn.bodyFat === null || checkIn.bodyFat === undefined
                    ? "-"
                    : `${checkIn.bodyFat.toFixed(1)}%`
                }
              />
              <SmallStat label="Mood" value={checkIn.mood ?? "-"} />
            </div>
            {checkIn.notes ? (
              <p className="mt-3 text-sm text-muted-foreground">{checkIn.notes}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function PhotosTab({
  photosByCheckIn,
  checkIns,
  compareIds,
  onCompareChange,
  galleryCheckInId,
  onOpenGallery,
  onCloseGallery,
  revealedPhotos,
  onRevealPhoto
}: {
  photosByCheckIn: { checkIn: BodyCheckIn; photos: ProgressPhoto[] }[];
  checkIns: BodyCheckIn[];
  compareIds: { left: string; right: string };
  onCompareChange: (ids: { left: string; right: string }) => void;
  galleryCheckInId: string | null;
  onOpenGallery: (checkInId: string) => void;
  onCloseGallery: () => void;
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
}) {
  const leftEntry = photosByCheckIn.find((entry) => entry.checkIn.id === compareIds.left);
  const rightEntry = photosByCheckIn.find((entry) => entry.checkIn.id === compareIds.right);
  const galleryEntry = photosByCheckIn.find((entry) => entry.checkIn.id === galleryCheckInId);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/90 p-4">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold tracking-normal">Photo Comparison</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Left"
            value={compareIds.left}
            onChange={(left) => {
              onCompareChange({ ...compareIds, left });
            }}
            options={checkIns.map((checkIn) => ({
              value: checkIn.id,
              label: formatBodyDate(checkIn.date, true)
            }))}
          />
          <SelectField
            label="Right"
            value={compareIds.right}
            onChange={(right) => {
              onCompareChange({ ...compareIds, right });
            }}
            options={checkIns.map((checkIn) => ({
              value: checkIn.id,
              label: formatBodyDate(checkIn.date, true)
            }))}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ComparePanel
            label="Left"
            entry={leftEntry}
            revealedPhotos={revealedPhotos}
            onRevealPhoto={onRevealPhoto}
          />
          <ComparePanel
            label="Right"
            entry={rightEntry}
            revealedPhotos={revealedPhotos}
            onRevealPhoto={onRevealPhoto}
          />
        </div>
      </div>

      <div className="space-y-3">
        {photosByCheckIn.map(({ checkIn, photos: entryPhotos }) => (
          <button
            key={checkIn.id}
            type="button"
            onClick={() => {
              onOpenGallery(checkIn.id);
            }}
            className="w-full rounded-2xl border border-border bg-card/90 p-4 text-left transition-colors hover:border-foreground/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{formatBodyDate(checkIn.date, true)}</h3>
                <p className="text-sm text-muted-foreground">
                  {checkIn.weight?.toFixed(1) ?? "-"} kg
                </p>
              </div>
              <span className="text-sm text-muted-foreground">{entryPhotos.length} photos</span>
            </div>
            <PhotoStrip
              photos={entryPhotos.slice(0, 4)}
              revealedPhotos={revealedPhotos}
              onRevealPhoto={onRevealPhoto}
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {galleryEntry ? (
          <GalleryModal
            entry={galleryEntry}
            revealedPhotos={revealedPhotos}
            onRevealPhoto={onRevealPhoto}
            onClose={onCloseGallery}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function JournalTab({
  entries,
  onNew,
  onWorkoutReflection,
  onDelete
}: {
  entries: JournalEntry[];
  onNew: () => void;
  onWorkoutReflection: () => void;
  onDelete: (entryId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onWorkoutReflection}>
          <DumbbellIcon />
          Workout Reflection
        </Button>
        <Button onClick={onNew}>
          <Plus className="size-4" aria-hidden="true" />
          New Journal
        </Button>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="hover-lift animate-rise-in rounded-2xl border border-border bg-card/90 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{formatBodyDate(entry.date, true)}</p>
                <h2 className="text-xl font-semibold tracking-normal">{entry.title}</h2>
                {entry.mood ? <p className="mt-1 text-sm text-primary">{entry.mood}</p> : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onDelete(entry.id);
                }}
                aria-label="Delete journal"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {entry.workoutSummary ? (
              <div className="mt-3 rounded-md border border-border bg-background/50 p-3 text-sm">
                <p className="font-medium">{entry.workoutSummary.name}</p>
                <p className="text-muted-foreground">{entry.workoutSummary.exercises.join(", ")}</p>
              </div>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {entry.content}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CheckInEditor({
  draft,
  photos,
  revealedPhotos,
  onRevealPhoto,
  onChange,
  onPhotosChange,
  onClose,
  onSave
}: {
  draft: BodyCheckIn;
  photos: ProgressPhoto[];
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
  onChange: (draft: BodyCheckIn) => void;
  onPhotosChange: (photos: ProgressPhoto[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const draftPhotos = photos.filter((photo) => photo.checkInId === draft.id);

  async function handlePhotoUpload(files: FileList | null, category: BodyPhotoCategory) {
    if (!files) {
      return;
    }

    const encryptedPhotos = await Promise.all(
      Array.from(files).map((file) =>
        createEncryptedProgressPhoto({ checkInId: draft.id, category, file })
      )
    );

    onPhotosChange([...encryptedPhotos, ...photos]);
    onChange({
      ...draft,
      photoIds: [...draft.photoIds, ...encryptedPhotos.map((photo) => photo.id)]
    });
  }

  return (
    <ModalShell title="New Check-in" eyebrow="Body Progress" onClose={onClose}>
      <section className="grid gap-3 rounded-md border border-border bg-background/50 p-3 sm:grid-cols-2">
        <TextField
          label="Date"
          type="date"
          value={draft.date}
          onChange={(date) => {
            onChange({ ...draft, date, updatedAt: Date.now() });
          }}
        />
        <TextField
          label="Time"
          type="time"
          value={draft.time}
          onChange={(time) => {
            onChange({ ...draft, time, updatedAt: Date.now() });
          }}
        />
        <NumberField
          label="Weight"
          value={draft.weight}
          suffix="kg"
          onChange={(weight) => {
            onChange({ ...draft, weight, updatedAt: Date.now() });
          }}
        />
        <NumberField
          label="Body Fat"
          value={draft.bodyFat ?? null}
          suffix="%"
          onChange={(bodyFat) => {
            onChange({ ...draft, bodyFat, updatedAt: Date.now() });
          }}
        />
        <SelectField
          label="Mood"
          value={draft.mood ?? ""}
          onChange={(mood) => {
            onChange({ ...draft, mood: mood as BodyMood | "", updatedAt: Date.now() });
          }}
          options={[
            { value: "", label: "Select mood" },
            ...BODY_MOODS.map((mood) => ({ value: mood, label: mood }))
          ]}
        />
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-muted-foreground">Notes</span>
          <textarea
            value={draft.notes ?? ""}
            onChange={(event) => {
              onChange({ ...draft, notes: event.target.value, updatedAt: Date.now() });
            }}
            className="min-h-24 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary/70"
          />
        </label>
      </section>

      <section className="rounded-md border border-border bg-background/50 p-3">
        <h3 className="font-semibold">Measurements</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BODY_MEASUREMENT_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              label={field.label}
              value={draft.measurements[field.key] ?? null}
              suffix="cm"
              onChange={(value) => {
                onChange({
                  ...draft,
                  measurements: { ...draft.measurements, [field.key]: value ?? undefined },
                  updatedAt: Date.now()
                });
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-background/50 p-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-primary" aria-hidden="true" />
          <h3 className="font-semibold">Private Photos</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos are encrypted before local storage and blurred until tapped.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {PHOTO_CATEGORIES.map((category) => (
            <label
              key={category}
              className="grid min-h-16 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-muted px-2 text-center text-sm hover:border-foreground/40"
            >
              <Camera className="mb-1 size-4 text-primary" aria-hidden="true" />
              {category}
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void handlePhotoUpload(event.target.files, category)}
              />
            </label>
          ))}
        </div>
        <PhotoStrip
          photos={draftPhotos}
          revealedPhotos={revealedPhotos}
          onRevealPhoto={onRevealPhoto}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onClose}>
          Keep Draft
        </Button>
        <Button onClick={onSave}>
          <Save className="size-4" aria-hidden="true" />
          Save Check-in
        </Button>
      </div>
    </ModalShell>
  );
}

function JournalEditor({
  draft,
  onChange,
  onClose,
  onSave
}: {
  draft: JournalEntry;
  onChange: (draft: JournalEntry) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalShell title="Journal Entry" eyebrow="Private Notes" onClose={onClose}>
      <section className="grid gap-3 rounded-md border border-border bg-background/50 p-3 sm:grid-cols-2">
        <TextField
          label="Date"
          type="date"
          value={draft.date}
          onChange={(date) => {
            onChange({ ...draft, date, updatedAt: Date.now() });
          }}
        />
        <SelectField
          label="Mood"
          value={draft.mood ?? ""}
          onChange={(mood) => {
            onChange({ ...draft, mood: mood as BodyMood | "", updatedAt: Date.now() });
          }}
          options={[
            { value: "", label: "Select mood" },
            ...BODY_MOODS.map((mood) => ({ value: mood, label: mood }))
          ]}
        />
        <TextField
          className="sm:col-span-2"
          label="Title"
          value={draft.title}
          onChange={(title) => {
            onChange({ ...draft, title, updatedAt: Date.now() });
          }}
          placeholder="Felt much stronger today"
        />
        {draft.workoutSummary ? (
          <div className="rounded-xl border border-border bg-muted p-3 text-sm sm:col-span-2">
            <p className="font-medium">{draft.workoutSummary.name}</p>
            <p className="text-muted-foreground">{draft.workoutSummary.duration}</p>
            <p className="mt-1 text-muted-foreground">
              {draft.workoutSummary.exercises.join(", ")}
            </p>
          </div>
        ) : null}
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-muted-foreground">Notes</span>
          <textarea
            value={draft.content}
            onChange={(event) => {
              onChange({ ...draft, content: event.target.value, updatedAt: Date.now() });
            }}
            className="min-h-72 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary/70"
          />
        </label>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onClose}>
          Keep Draft
        </Button>
        <Button onClick={onSave}>
          <Save className="size-4" aria-hidden="true" />
          Save Journal
        </Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  eyebrow,
  title,
  onClose,
  children
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 backdrop-blur-xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
    >
      <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary">{eyebrow}</p>
            <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function PhotoStrip({
  photos,
  revealedPhotos,
  onRevealPhoto
}: {
  photos: ProgressPhoto[];
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
}) {
  if (photos.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No photos for this entry.</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRevealPhoto(photo);
          }}
          className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted"
        >
          {revealedPhotos[photo.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={revealedPhotos[photo.id]}
              alt={`${photo.category} progress`}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center backdrop-blur-xl">
              <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium">
            {revealedPhotos[photo.id] ? photo.category : "Tap to reveal"}
          </span>
        </button>
      ))}
    </div>
  );
}

function ComparePanel({
  label,
  entry,
  revealedPhotos,
  onRevealPhoto
}: {
  label: string;
  entry: { checkIn: BodyCheckIn; photos: ProgressPhoto[] } | undefined;
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-sm font-medium text-primary">{label}</p>
      {entry ? (
        <>
          <h3 className="mt-1 font-semibold">{formatBodyDate(entry.checkIn.date, true)}</h3>
          <p className="text-sm text-muted-foreground">
            {entry.checkIn.weight?.toFixed(1) ?? "-"} kg
          </p>
          <PhotoStrip
            photos={entry.photos.slice(0, 1)}
            revealedPhotos={revealedPhotos}
            onRevealPhoto={onRevealPhoto}
          />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Choose a check-in.</p>
      )}
    </div>
  );
}

function GalleryModal({
  entry,
  revealedPhotos,
  onRevealPhoto,
  onClose
}: {
  entry: { checkIn: BodyCheckIn; photos: ProgressPhoto[] };
  revealedPhotos: Record<string, string>;
  onRevealPhoto: (photo: ProgressPhoto) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary">Private Gallery</p>
            <h2 className="text-xl font-semibold">{formatBodyDate(entry.checkIn.date, true)}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close gallery">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        <PhotoStrip
          photos={entry.photos}
          revealedPhotos={revealedPhotos}
          onRevealPhoto={onRevealPhoto}
        />
      </div>
    </motion.div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function RangePicker({
  range,
  onChange
}: {
  range: BodyProgressRange;
  onChange: (range: BodyProgressRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BODY_PROGRESS_RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value);
          }}
          className={cn(
            "h-9 rounded-md px-3 text-sm font-medium transition-colors",
            range === option.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-2", className)}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:border-primary/70"
      />
    </label>
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
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex h-11 items-center rounded-xl border border-border bg-muted focus-within:border-primary/70">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
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
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-11 w-full appearance-none rounded-xl border border-border bg-muted px-3 pr-9 text-sm outline-none focus:border-primary/70"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

function DumbbellIcon() {
  return <FileText className="size-4" aria-hidden="true" />;
}

function formatDelta(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12
};
