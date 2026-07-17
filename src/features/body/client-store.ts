import type {
  BodyCheckIn,
  BodyMeasurementKey,
  BodyMood,
  BodyProgressRange,
  BodyProgressStats,
  BodyTrendPoint,
  JournalEntry,
  ProgressPhoto
} from "@/types/body-progress";

export const BODY_CHECK_INS_STORAGE_KEY = "bodyProgress.checkIns.v1";
export const BODY_PHOTOS_STORAGE_KEY = "bodyProgress.photos.v1";
export const BODY_JOURNAL_STORAGE_KEY = "bodyProgress.journal.v1";
export const BODY_CHECK_IN_DRAFT_STORAGE_KEY = "bodyProgress.checkInDraft.v1";
export const BODY_JOURNAL_DRAFT_STORAGE_KEY = "bodyProgress.journalDraft.v1";
const BODY_PHOTO_SECRET_STORAGE_KEY = "bodyProgress.photoSecret.v1";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const BODY_MEASUREMENT_FIELDS: { key: BodyMeasurementKey; label: string }[] = [
  { key: "neck", label: "Neck" },
  { key: "shoulders", label: "Shoulders" },
  { key: "chest", label: "Chest" },
  { key: "leftArm", label: "Left Arm" },
  { key: "rightArm", label: "Right Arm" },
  { key: "leftForearm", label: "Left Forearm" },
  { key: "rightForearm", label: "Right Forearm" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "leftThigh", label: "Left Thigh" },
  { key: "rightThigh", label: "Right Thigh" },
  { key: "leftCalf", label: "Left Calf" },
  { key: "rightCalf", label: "Right Calf" }
];

export const BODY_MOODS: BodyMood[] = ["Amazing", "Good", "Normal", "Low Energy", "Tired"];

export const BODY_PROGRESS_RANGES: { value: BodyProgressRange; label: string }[] = [
  { value: "1M", label: "1 Month" },
  { value: "3M", label: "3 Months" },
  { value: "6M", label: "6 Months" },
  { value: "1Y", label: "1 Year" },
  { value: "ALL", label: "All Time" }
];

export function createBodyId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getBodyTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentTimeKey() {
  return new Date().toTimeString().slice(0, 5);
}

export function createEmptyCheckIn(): BodyCheckIn {
  return {
    id: createBodyId("checkin"),
    date: getBodyTodayKey(),
    time: getCurrentTimeKey(),
    weight: null,
    bodyFat: null,
    measurements: {},
    notes: "",
    photoIds: [],
    mood: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function createEmptyJournalEntry(linkedCheckInId?: string): JournalEntry {
  return {
    id: createBodyId("journal"),
    date: getBodyTodayKey(),
    title: "",
    mood: "",
    content: "",
    ...(linkedCheckInId ? { linkedCheckInId } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function getSeedCheckIns(): BodyCheckIn[] {
  return [
    {
      id: createBodyId("checkin"),
      date: "2026-06-17",
      time: "08:10",
      weight: 69.6,
      bodyFat: 15.8,
      measurements: { chest: 102, waist: 83, shoulders: 121, leftArm: 36, rightArm: 36.2 },
      notes: "Starting a cleaner cut. Sleep has been mixed.",
      photoIds: [],
      mood: "Normal",
      createdAt: new Date("2026-06-17T08:10:00").getTime(),
      updatedAt: new Date("2026-06-17T08:10:00").getTime()
    },
    {
      id: createBodyId("checkin"),
      date: "2026-07-03",
      time: "08:20",
      weight: 68.1,
      bodyFat: 14.9,
      measurements: { chest: 102.5, waist: 81.8, shoulders: 122, leftThigh: 60, rightThigh: 60.2 },
      notes: "Waist is moving down while training performance is holding.",
      photoIds: [],
      mood: "Good",
      createdAt: new Date("2026-07-03T08:20:00").getTime(),
      updatedAt: new Date("2026-07-03T08:20:00").getTime()
    },
    {
      id: createBodyId("checkin"),
      date: "2026-07-17",
      time: "08:05",
      weight: 67.2,
      bodyFat: 14.4,
      measurements: {
        chest: 103,
        waist: 81,
        leftArm: 37,
        rightArm: 37,
        leftThigh: 60,
        rightThigh: 60,
        leftCalf: 39,
        rightCalf: 39,
        neck: 39,
        shoulders: 122
      },
      notes: "Looking tighter. Energy was great today.",
      photoIds: [],
      mood: "Amazing",
      createdAt: new Date("2026-07-17T08:05:00").getTime(),
      updatedAt: new Date("2026-07-17T08:05:00").getTime()
    }
  ];
}

export function getSeedJournalEntries(): JournalEntry[] {
  return [
    {
      id: createBodyId("journal"),
      date: "2026-07-17",
      title: "Felt stronger today",
      mood: "Amazing",
      content:
        "Bench finally reached 80kg. Energy was great. Need to keep improving sleep before heavy push sessions.",
      createdAt: new Date("2026-07-17T21:30:00").getTime(),
      updatedAt: new Date("2026-07-17T21:30:00").getTime()
    }
  ];
}

export function loadBodyCheckIns() {
  const parsed = readJson(BODY_CHECK_INS_STORAGE_KEY);
  const checkIns = Array.isArray(parsed) ? parsed.filter(isBodyCheckIn) : [];

  if (checkIns.length > 0) {
    return checkIns;
  }

  const seeded = getSeedCheckIns();
  saveBodyCheckIns(seeded);
  return seeded;
}

export function saveBodyCheckIns(checkIns: BodyCheckIn[]) {
  localStorage.setItem(BODY_CHECK_INS_STORAGE_KEY, JSON.stringify(checkIns));
}

export function loadProgressPhotos() {
  const parsed = readJson(BODY_PHOTOS_STORAGE_KEY);
  return Array.isArray(parsed) ? parsed.filter(isProgressPhoto) : [];
}

export function saveProgressPhotos(photos: ProgressPhoto[]) {
  localStorage.setItem(BODY_PHOTOS_STORAGE_KEY, JSON.stringify(photos));
}

export function loadJournalEntries() {
  const parsed = readJson(BODY_JOURNAL_STORAGE_KEY);
  const entries = Array.isArray(parsed) ? parsed.filter(isJournalEntry) : [];

  if (entries.length > 0) {
    return entries;
  }

  const seeded = getSeedJournalEntries();
  saveJournalEntries(seeded);
  return seeded;
}

export function saveJournalEntries(entries: JournalEntry[]) {
  localStorage.setItem(BODY_JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

export function sortCheckIns(checkIns: BodyCheckIn[], direction: "asc" | "desc" = "desc") {
  return checkIns
    .slice()
    .sort((a, b) =>
      direction === "desc"
        ? `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
        : `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    );
}

export function sortJournalEntries(entries: JournalEntry[]) {
  return entries
    .slice()
    .sort((a, b) =>
      `${b.date}T${String(b.createdAt)}`.localeCompare(`${a.date}T${String(a.createdAt)}`)
    );
}

export function getBodyTrendPoints(checkIns: BodyCheckIn[]): BodyTrendPoint[] {
  return sortCheckIns(checkIns, "asc").map((checkIn) => ({
    date: checkIn.date,
    weight: checkIn.weight,
    bodyFat: checkIn.bodyFat ?? null,
    ...checkIn.measurements
  }));
}

export function filterBodyTrend(points: BodyTrendPoint[], range: BodyProgressRange) {
  if (range === "ALL" || points.length === 0) {
    return points;
  }

  const days = { "1M": 31, "3M": 93, "6M": 186, "1Y": 365 }[range];
  const latest = Math.max(...points.map((point) => new Date(`${point.date}T12:00:00`).getTime()));

  return points.filter(
    (point) => latest - new Date(`${point.date}T12:00:00`).getTime() <= days * MS_PER_DAY
  );
}

export function getBodyProgressStats(
  checkIns: BodyCheckIn[],
  photos: ProgressPhoto[],
  journals: JournalEntry[]
): BodyProgressStats {
  const sorted = sortCheckIns(checkIns, "asc").filter((checkIn) => checkIn.weight !== null);
  const weights = sorted.map((checkIn) => checkIn.weight).filter((weight) => weight !== null);
  const current = sorted.at(-1);
  const first = sorted[0];
  const previousWeek = findNearestCheckIn(sorted, 7);
  const previousMonth = findNearestCheckIn(sorted, 31);
  const bodyFatValues = sorted
    .map((checkIn) => checkIn.bodyFat)
    .filter((bodyFat): bodyFat is number => typeof bodyFat === "number");

  return {
    totalCheckIns: checkIns.length,
    currentWeight: current?.weight ?? null,
    highestWeight: weights.length > 0 ? Math.max(...weights) : null,
    lowestWeight: weights.length > 0 ? Math.min(...weights) : null,
    weeklyChange: getWeightDelta(current, previousWeek),
    monthlyChange: getWeightDelta(current, previousMonth),
    totalChange: getWeightDelta(current, first),
    averageWeeklyChange: getAverageWeeklyChange(first, current),
    bodyFatTrend: getNumberDelta(bodyFatValues),
    photoCount: photos.length,
    journalStreak: getDateStreak(journals.map((entry) => entry.date)),
    longestCheckInStreak: getLongestDateStreak(checkIns.map((checkIn) => checkIn.date))
  };
}

function getNumberDelta(values: number[]) {
  const first = values[0];
  const latest = values[values.length - 1];

  if (first === undefined || latest === undefined || values.length < 2) {
    return null;
  }

  return Number((latest - first).toFixed(1));
}

export function formatBodyDate(dateKey: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: includeYear ? "numeric" : undefined
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function formatMeasurementValue(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)} cm`;
}

export async function createEncryptedProgressPhoto(input: {
  checkInId: string;
  category: ProgressPhoto["category"];
  file: File;
}): Promise<ProgressPhoto> {
  const id = createBodyId("photo");
  const dataUrl = await fileToCompressedDataUrl(input.file);
  const encrypted = await encryptText(dataUrl);

  return {
    id,
    checkInId: input.checkInId,
    category: input.category,
    imagePath: `local-encrypted://${id}`,
    encryptedData: encrypted.encryptedData,
    iv: encrypted.iv,
    mimeType: input.file.type || "image/jpeg",
    createdAt: Date.now()
  };
}

export async function decryptProgressPhoto(photo: ProgressPhoto) {
  return decryptText(photo.encryptedData, photo.iv);
}

function readJson(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function isBodyCheckIn(value: unknown): value is BodyCheckIn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const checkIn = value as Partial<BodyCheckIn>;
  return (
    typeof checkIn.id === "string" &&
    typeof checkIn.date === "string" &&
    typeof checkIn.time === "string" &&
    typeof checkIn.measurements === "object" &&
    Array.isArray(checkIn.photoIds)
  );
}

function isProgressPhoto(value: unknown): value is ProgressPhoto {
  if (!value || typeof value !== "object") {
    return false;
  }

  const photo = value as Partial<ProgressPhoto>;
  return (
    typeof photo.id === "string" &&
    typeof photo.checkInId === "string" &&
    typeof photo.encryptedData === "string" &&
    typeof photo.iv === "string"
  );
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<JournalEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    typeof entry.content === "string"
  );
}

function findNearestCheckIn(checkIns: BodyCheckIn[], daysAgo: number) {
  const current = checkIns.at(-1);

  if (!current) {
    return undefined;
  }

  const target = new Date(`${current.date}T12:00:00`).getTime() - daysAgo * MS_PER_DAY;

  return checkIns.slice(0, -1).reduce<BodyCheckIn | undefined>((nearest, checkIn) => {
    const checkInTime = new Date(`${checkIn.date}T12:00:00`).getTime();
    const nearestTime = nearest ? new Date(`${nearest.date}T12:00:00`).getTime() : 0;

    return Math.abs(checkInTime - target) < Math.abs(nearestTime - target) ? checkIn : nearest;
  }, undefined);
}

function getWeightDelta(current?: BodyCheckIn, previous?: BodyCheckIn) {
  if (
    current?.weight === null ||
    current?.weight === undefined ||
    previous?.weight === null ||
    previous?.weight === undefined
  ) {
    return null;
  }

  return Number((current.weight - previous.weight).toFixed(1));
}

function getAverageWeeklyChange(first?: BodyCheckIn, current?: BodyCheckIn) {
  const totalChange = getWeightDelta(current, first);

  if (totalChange === null || !first || !current) {
    return null;
  }

  const days = Math.max(
    (new Date(`${current.date}T12:00:00`).getTime() -
      new Date(`${first.date}T12:00:00`).getTime()) /
      MS_PER_DAY,
    1
  );

  return Number(((totalChange / days) * 7).toFixed(2));
}

function getDateStreak(dates: string[]) {
  const uniqueDates = new Set(dates);
  let streak = 0;
  let cursor = new Date(`${getBodyTodayKey()}T12:00:00`);

  while (uniqueDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }

  return streak;
}

function getLongestDateStreak(dates: string[]) {
  const uniqueSortedDates = Array.from(new Set(dates)).sort();
  let longest = 0;
  let current = 0;
  let previousTime = 0;

  uniqueSortedDates.forEach((date) => {
    const time = new Date(`${date}T12:00:00`).getTime();
    current = time - previousTime === MS_PER_DAY ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousTime = time;
  });

  return longest;
}

async function fileToCompressedDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    return fileToDataUrl(file);
  }

  try {
    const originalDataUrl = await fileToDataUrl(file);
    const image = await loadImage(originalDataUrl);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(Math.round(image.naturalWidth * scale), 1);
    const height = Math.max(Math.round(image.naturalHeight * scale), 1);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return originalDataUrl;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return fileToDataUrl(file);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Unable to process progress photo."));
    };
    image.src = src;
  });
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read progress photo."));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read progress photo."));
    };
    reader.readAsDataURL(file);
  });
}

async function encryptText(text: string) {
  const key = await getPhotoEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    encryptedData: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv)
  };
}

async function decryptText(encryptedData: string, iv: string) {
  const key = await getPhotoEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8Array(iv) },
    key,
    base64ToUint8Array(encryptedData)
  );

  return new TextDecoder().decode(decrypted);
}

async function getPhotoEncryptionKey() {
  const secret = getOrCreatePhotoSecret();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("ascension-body-progress-local-photos"),
      iterations: 120000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function getOrCreatePhotoSecret() {
  const existing = localStorage.getItem(BODY_PHOTO_SECRET_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = arrayBufferToBase64(bytes);
  localStorage.setItem(BODY_PHOTO_SECRET_STORAGE_KEY, secret);
  return secret;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
