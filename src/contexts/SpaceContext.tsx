import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  confirmGift,
  createGift as apiCreateGift,
  createSpace,
  getSpacePoints,
  listGifts,
  listSpaces,
} from "../api/client";
import type {
  Gift,
  GiftPriority,
  GiftStatus,
  GiftTimelineEntry,
  GiftWithMeta,
  LedgerEntry,
  Redemption,
  Reward,
  Space,
} from "../api/types";
import { generateId } from "../utils/id";
import { useToast } from "./ToastContext";

const DEFAULT_SPACE_NAME = "Demo Space";
const DEFAULT_CREATED_BY = "You";

function calculatePoints(mode: string, price: number | null) {
  if (mode === "sentiment") {
    return 10;
  }
  if (typeof price !== "number" || Number.isNaN(price)) {
    return 0;
  }
  return Math.max(0, Math.ceil(price));
}

interface SpaceContextValue {
  spaces: Space[];
  activeSpace: Space | null;
  loading: boolean;
  gifts: GiftWithMeta[];
  ledger: LedgerEntry[];
  rewards: Reward[];
  redemptions: Redemption[];
  refreshSpace: () => Promise<void>;
  refreshGifts: () => Promise<void>;
  createGift: (payload: { name: string; url: string; price?: number | null; category?: string | null; image?: string | null; priority?: GiftPriority }) => Promise<GiftWithMeta | null>;
  reserveGift: (giftId: number, actor: string) => void;
  moveGiftToStatus: (giftId: number, status: GiftStatus, actor?: string) => void;
  archiveGift: (giftId: number) => void;
  confirmGiftReceipt: (giftId: number) => Promise<void>;
  updateGiftPriority: (giftId: number, priority: GiftPriority) => void;
  createReward: (payload: { title: string; description: string; cost: number; stock?: number; expiresAt?: string }) => Reward;
  redeemReward: (rewardId: string, actor: string) => void;
}

const SpaceContext = createContext<SpaceContextValue | undefined>(undefined);

function buildGiftMeta(gift: Gift, status: GiftStatus, priority: GiftPriority = "medium"): GiftWithMeta {
  const timeline: GiftTimelineEntry[] = [
    {
      id: generateId("timeline"),
      label: "Added to wishlist",
      timestamp: gift.createdAt,
      description: gift.url,
    },
  ];

  if (gift.confirmed) {
    timeline.push({
      id: generateId("timeline"),
      label: "Received",
      timestamp: gift.updatedAt,
    });
  }

  return {
    ...gift,
    status,
    priority,
    timeline,
  };
}

const initialRewards: Reward[] = [
  {
    id: generateId("reward"),
    title: "Breakfast in bed",
    description: "Homemade pancakes + coffee service.",
    cost: 120,
    createdAt: new Date().toISOString(),
    createdBy: DEFAULT_CREATED_BY,
    stock: 2,
    remaining: 2,
  },
  {
    id: generateId("reward"),
    title: "Movie night of your choice",
    description: "You pick the film, I'll handle snacks and setup.",
    cost: 80,
    createdAt: new Date().toISOString(),
    createdBy: DEFAULT_CREATED_BY,
  },
];

const initialLedger: LedgerEntry[] = [
  {
    id: generateId("ledger"),
    type: "earn",
    amount: 90,
    description: "Confirmed: Wireless earbuds",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: generateId("ledger"),
    type: "spend",
    amount: 60,
    description: "Redeemed: Cozy brunch date",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
];

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(null);
  const [gifts, setGifts] = useState<GiftWithMeta[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>(initialLedger);
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const loadedSpaces = await listSpaces();
        if (loadedSpaces.length === 0) {
          const { space } = await createSpace({ name: DEFAULT_SPACE_NAME });
          setSpaces([space]);
          setActiveSpaceId(space.id);
        } else {
          setSpaces(loadedSpaces);
          setActiveSpaceId(loadedSpaces[0].id);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "Failed to load spaces", "error");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [notify]);

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId],
  );

  const refreshSpace = useCallback(async () => {
    if (!activeSpace) {
      return;
    }
    try {
      const refreshedSpaces = await listSpaces();
      setSpaces(refreshedSpaces);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to refresh space", "error");
    }
  }, [activeSpace, notify]);

  const refreshGifts = useCallback(async () => {
    if (!activeSpace) {
      return;
    }
    try {
      const data = await listGifts(activeSpace.id);
      setGifts(
        data
          .map((gift) =>
            buildGiftMeta(
              gift,
              gift.confirmed ? "received" : "wanted",
              gift.price && gift.price > 250 ? "high" : gift.price && gift.price > 75 ? "medium" : "low",
            ),
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to load gifts", "error");
    }
  }, [activeSpace, notify]);

  useEffect(() => {
    if (!activeSpace) {
      setGifts([]);
      return;
    }
    refreshGifts();
  }, [activeSpace, refreshGifts]);

  const createGift = useCallback<SpaceContextValue["createGift"]>(
    async ({ name, url, price = null, category = null, image = null, priority = "medium" }) => {
      if (!activeSpace) {
        notify("Select a space before adding gifts", "error");
        return null;
      }
      const optimistic: GiftWithMeta = {
        id: Number.MAX_SAFE_INTEGER - Math.floor(Math.random() * 1000),
        name,
        url,
        price,
        category,
        image,
        confirmed: false,
        spaceId: activeSpace.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "wanted",
        priority,
        timeline: [
          {
            id: generateId("timeline"),
            label: "Added to wishlist",
            timestamp: new Date().toISOString(),
            description: url,
          },
        ],
      };

      setGifts((prev) => [optimistic, ...prev]);

      try {
        const created = await apiCreateGift(activeSpace.id, { name, url, price, category, image });
        const meta = buildGiftMeta(created, "wanted", priority);
        setGifts((prev) => [meta, ...prev.filter((gift) => gift.id !== optimistic.id)]);
        notify(`Added “${name}” to wishlist`);
        return meta;
      } catch (error) {
        setGifts((prev) => prev.filter((gift) => gift.id !== optimistic.id));
        notify(error instanceof Error ? error.message : "Failed to add gift", "error");
        return null;
      }
    },
    [activeSpace, notify],
  );

  const updateGiftMeta = useCallback((giftId: number, updater: (gift: GiftWithMeta) => GiftWithMeta) => {
    setGifts((prev) => prev.map((gift) => (gift.id === giftId ? updater(gift) : gift)));
  }, []);

  const appendTimeline = useCallback((giftId: number, entry: Partial<Omit<GiftTimelineEntry, "id">> & { label: string }) => {
    updateGiftMeta(giftId, (gift) => ({
      ...gift,
      timeline: [
        ...gift.timeline,
        {
          label: entry.label,
          description: entry.description,
          actor: entry.actor,
          id: generateId("timeline"),
          timestamp: entry.timestamp ?? new Date().toISOString(),
        },
      ],
    }));
  }, [updateGiftMeta]);

  const reserveGift = useCallback<SpaceContextValue["reserveGift"]>((giftId, actor) => {
    appendTimeline(giftId, { label: "Reserved", actor, description: `${actor} reserved this gift.` });
    updateGiftMeta(giftId, (gift) => ({
      ...gift,
      status: "reserved",
      reservedBy: actor,
    }));
    notify("Gift reserved");
  }, [appendTimeline, notify, updateGiftMeta]);

  const moveGiftToStatus = useCallback<SpaceContextValue["moveGiftToStatus"]>((giftId, status, actor) => {
    updateGiftMeta(giftId, (gift) => ({
      ...gift,
      status,
    }));
    appendTimeline(giftId, {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      actor,
    });
  }, [appendTimeline, updateGiftMeta]);

  const confirmGiftReceipt = useCallback<SpaceContextValue["confirmGiftReceipt"]>(
    async (giftId) => {
      const gift = gifts.find((item) => item.id === giftId);
      if (!gift || !activeSpace) {
        return;
      }
      try {
        await confirmGift(giftId);
        const awarded = calculatePoints(activeSpace.mode, gift.price);
        appendTimeline(giftId, { label: "Received", description: "Recipient confirmed receipt." });
        updateGiftMeta(giftId, (item) => ({
          ...item,
          status: "received",
          confirmed: true,
        }));
        setLedger((prev) => [
          {
            id: generateId("ledger"),
            type: "earn",
            amount: awarded,
            description: `Received confirmation: ${gift.name}`,
            createdAt: new Date().toISOString(),
            relatedGiftId: giftId,
          },
          ...prev,
        ]);
        const { points } = await getSpacePoints(activeSpace.id);
        setSpaces((prev) =>
          prev.map((space) =>
            space.id === activeSpace.id
              ? {
                  ...space,
                  points,
                }
              : space,
          ),
        );
        notify(`Awarded ${awarded} pts`);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Failed to confirm gift", "error");
      }
    },
    [activeSpace, appendTimeline, gifts, notify],
  );

  const updateGiftPriority = useCallback<SpaceContextValue["updateGiftPriority"]>((giftId, priority) => {
    updateGiftMeta(giftId, (gift) => ({
      ...gift,
      priority,
    }));
  }, [updateGiftMeta]);

  const archiveGift = useCallback<SpaceContextValue["archiveGift"]>((giftId) => {
    updateGiftMeta(giftId, (gift) => ({
      ...gift,
      status: "archived",
    }));
    appendTimeline(giftId, { label: "Archived" });
  }, [appendTimeline, updateGiftMeta]);

  const createReward = useCallback<SpaceContextValue["createReward"]>((payload) => {
    const reward: Reward = {
      id: generateId("reward"),
      createdAt: new Date().toISOString(),
      createdBy: DEFAULT_CREATED_BY,
      remaining: payload.stock,
      ...payload,
    };
    setRewards((prev) => [reward, ...prev]);
    notify(`Created reward “${payload.title}”`);
    return reward;
  }, [notify]);

  const adjustPoints = useCallback((delta: number) => {
    if (!activeSpace) return;
    setSpaces((prev) =>
      prev.map((space) =>
        space.id === activeSpace.id
          ? {
              ...space,
              points: Math.max(0, (space.points ?? 0) + delta),
            }
          : space,
      ),
    );
  }, [activeSpace]);

  const redeemReward = useCallback<SpaceContextValue["redeemReward"]>(
    (rewardId, _actor) => {
      const reward = rewards.find((item) => item.id === rewardId);
      if (!reward || !activeSpace) {
        notify("Reward unavailable", "error");
        return;
      }
      const currentPoints = spaces.find((space) => space.id === activeSpace.id)?.points ?? 0;
      if (currentPoints < reward.cost) {
        notify("Not enough points yet", "error");
        return;
      }
      const redemption: Redemption = {
        id: generateId("redemption"),
        rewardId: reward.id,
        rewardTitle: reward.title,
        spent: reward.cost,
        redeemedAt: new Date().toISOString(),
        status: "pending",
      };
      setRedemptions((prev) => [redemption, ...prev]);
      setRewards((prev) =>
        prev.map((item) =>
          item.id === reward.id
            ? {
                ...item,
                remaining:
                  typeof item.remaining === "number"
                    ? Math.max(0, item.remaining - 1)
                    : item.remaining,
              }
            : item,
        ),
      );
      adjustPoints(-reward.cost);
      setLedger((prev) => [
        {
          id: generateId("ledger"),
          type: "spend",
          amount: reward.cost,
          description: `Redeemed: ${reward.title}`,
          createdAt: new Date().toISOString(),
          relatedRewardId: reward.id,
        },
        ...prev,
      ]);
      notify(`Redeemed “${reward.title}”`);
    },
    [activeSpace, adjustPoints, notify, rewards, spaces],
  );

  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      activeSpace,
      loading,
      gifts,
      ledger,
      rewards,
      redemptions,
      refreshSpace,
      refreshGifts,
      createGift,
      reserveGift,
      moveGiftToStatus,
      archiveGift,
      confirmGiftReceipt,
      updateGiftPriority,
      createReward,
      redeemReward,
    }),
    [
      spaces,
      activeSpace,
      loading,
      gifts,
      ledger,
      rewards,
      redemptions,
      refreshSpace,
      refreshGifts,
      createGift,
      reserveGift,
      moveGiftToStatus,
      archiveGift,
      confirmGiftReceipt,
      updateGiftPriority,
      createReward,
      redeemReward,
    ],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpace must be used within SpaceProvider");
  }
  return context;
}
