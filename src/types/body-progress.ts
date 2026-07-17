export type BodyProgressTab = "overview" | "checkins" | "photos" | "journal";

export type BodyPhotoCategory = "Front" | "Back" | "Left Side" | "Right Side" | "Custom";

export type BodyMood = "Amazing" | "Good" | "Normal" | "Low Energy" | "Tired";

export type BodyProgressRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

export type BodyMeasurementKey =
  | "neck"
  | "shoulders"
  | "chest"
  | "leftArm"
  | "rightArm"
  | "leftForearm"
  | "rightForearm"
  | "waist"
  | "hips"
  | "leftThigh"
  | "rightThigh"
  | "leftCalf"
  | "rightCalf";

export type BodyMeasurements = Partial<Record<BodyMeasurementKey, number>>;

export interface BodyCheckIn {
  id: string;
  date: string;
  time: string;
  weight: number | null;
  bodyFat?: number | null;
  measurements: BodyMeasurements;
  notes?: string;
  photoIds: string[];
  mood?: BodyMood | "";
  journalId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressPhoto {
  id: string;
  checkInId: string;
  category: BodyPhotoCategory;
  imagePath: string;
  encryptedData: string;
  iv: string;
  mimeType: string;
  createdAt: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  mood?: BodyMood | "";
  content: string;
  linkedWorkoutId?: string;
  linkedCheckInId?: string;
  workoutSummary?: {
    name: string;
    duration?: string;
    exercises: string[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface BodyProgressStats {
  totalCheckIns: number;
  currentWeight: number | null;
  highestWeight: number | null;
  lowestWeight: number | null;
  weeklyChange: number | null;
  monthlyChange: number | null;
  totalChange: number | null;
  averageWeeklyChange: number | null;
  bodyFatTrend: number | null;
  photoCount: number;
  journalStreak: number;
  longestCheckInStreak: number;
}

export interface BodyTrendPoint {
  date: string;
  weight: number | null;
  bodyFat: number | null;
  neck?: number;
  shoulders?: number;
  chest?: number;
  leftArm?: number;
  rightArm?: number;
  waist?: number;
  hips?: number;
  leftThigh?: number;
  rightThigh?: number;
  leftCalf?: number;
  rightCalf?: number;
}
