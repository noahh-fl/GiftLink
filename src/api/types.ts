export interface Space {
  id: number;
  name: string;
  description: string | null;
  inviteCode: string;
  joinCode: string;
  mode: "price" | "sentiment" | string;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface Gift {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: number | null;
  category: string | null;
  confirmed: boolean;
  spaceId: number;
  createdAt: string;
  updatedAt: string;
}

export type GiftStatus =
  | "wanted"
  | "reserved"
  | "purchased"
  | "delivered"
  | "received"
  | "archived";

export type GiftPriority = "low" | "medium" | "high";

export interface GiftTimelineEntry {
  id: string;
  label: string;
  timestamp: string;
  description?: string;
  actor?: string;
}

export interface GiftWithMeta extends Gift {
  status: GiftStatus;
  priority: GiftPriority;
  reservedBy?: string;
  notes?: string;
  timeline: GiftTimelineEntry[];
  category: string | null;
}

export type LedgerType = "earn" | "spend";

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  amount: number;
  description: string;
  createdAt: string;
  relatedGiftId?: number;
  relatedRewardId?: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
  stock?: number;
  remaining?: number;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
}

export interface Redemption {
  id: string;
  rewardId: string;
  rewardTitle: string;
  spent: number;
  redeemedAt: string;
  status: "pending" | "fulfilled";
}
