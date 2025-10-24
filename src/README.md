GiftLink — Shared Wishlists & Point Rewards

A private, shared wishlist system for **couples, families, and professional teams**. Members can add gifts (e.g., Amazon links), others can reserve and confirm them, and once a gift is received, the giver earns **points**. These points can be spent in a **Point Shop** — a customizable marketplace of rewards defined by other users (like experiences, favors, or small perks).

GiftLink is designed with **Apple-style functional minimalism**: clean surfaces, clear hierarchy, soft motion, and intuitive flow.

---

## 🎯 Purpose

GiftLink solves a common problem — guessing what others actually want. It acts as a shared hub where users can drop wish ideas and turn thoughtful gifting into a fun, points-based experience.

It’s designed to feel at home in **personal**, **family**, or **work** environments:

* For **couples**: simplify gift-giving while keeping surprises.
* For **families**: coordinate birthdays, holidays, and shared wishlists.
* For **teams**: encourage small morale boosts and peer recognition.

---

## 🧱 Core Entities

| Entity              | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **User**            | Profile with name, avatar, notifications, and preferences.                                              |
| **Space**           | The shared environment (Pair, Family, or Team). Houses wishlists, point system, and shops.              |
| **Wishlist Item**   | A product added by URL. Auto-fetches image, title, price, category, etc.                                |
| **Gift**            | The reservation/purchase record tied to a wishlist item. Tracks giver, proof, and delivery status.      |
| **Point Ledger**    | Tracks points earned and spent with timestamps and reasons.                                             |
| **Point Shop Item** | Custom non-cash reward offered by users. Has title, description, price (in points), limits, and expiry. |

---

## ⚙️ Configuration Options

When creating a new Space, users choose how points are calculated and how visibility works.

### 🧩 Point System Modes

1. **Price-Indexed** — Points match the **price value**, rounded to the nearest whole point.

   * Example: a $24.60 item = **25 points**.
   * Great for budget-aligned or professional use.

2. **Sentiment-Valued** — Points reflect **personal importance** rather than cost.

   * Example: a $5 gift could be worth **50 points** if it’s meaningful.
   * Perfect for couples and family spaces.

> This setting is permanent per Space and defines how all points are awarded.

### 👁️ Visibility Options

* **Spoiler-safe** mode hides prices until the gift is confirmed.
* **Reservations** can be hidden (“maybe taken”) or visible.
* **Purchase proofs** can stay private or be shared with admins.

### 🧮 Governance Settings

* Off-list gifts can require recipient approval to award points.
* Optional return/issue handling (points on hold or reversal).
* Role support: Owner, Admin, Member.

---

## 🪄 Main Flows

### 1️⃣ Add to Wishlist

1. Paste a product link (Amazon, etc.).
2. GiftLink fetches title, price, image, category, and rating.
3. Add optional notes, tags, and priority level.
4. Item appears in your wishlist for others to browse.

### 2️⃣ Reserve → Purchase → Deliver → Confirm

1. **Reserve:** another user selects “I’ll get this.” Item becomes reserved for a set duration.
2. **Purchase:** user buys externally; in GiftLink they mark as purchased. The point value **locks** at this moment.
3. **Deliver:** giver toggles delivery.
4. **Confirm:** recipient confirms receipt → points instantly awarded to the giver.

### 3️⃣ Redeem Points in the Point Shop

1. Users create **custom rewards** (acts of service, experiences, perks).
   Example: “Homemade dinner,” “Free coffee,” “I’ll take your shift.”
2. Each reward has a **point price**, optional stock, and expiry date.
3. Others can **redeem** rewards using points they’ve earned.
4. Once fulfilled, the reward moves to **Memories** — a history of redeemed items.

---

## 📱 App Sections

| Section            | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| **Home Dashboard** | Overview of your points, gifts, and upcoming occasions.                |
| **My Wishlist**    | Manage items you’ve added. Edit, reorder, or archive.                  |
| **Browse**         | View other members’ wishlists, filter by price, category, or priority. |
| **Gifts**          | Track sent and received gifts with full status history.                |
| **Point Shop**     | Create, browse, redeem, and fulfill custom rewards.                    |
| **Ledger**         | Transparent record of all points earned/spent.                         |
| **Settings**       | Configure point mode, budgets, privacy, and notifications.             |

---

## 🔄 Lifecycle States

**Wishlist Item:**

* Wanted → Reserved → Purchased → Delivered → Received → Archived

**Point Shop Reward:**

* Listed → Redeemed → Completed → Archived

---

## 🔒 Privacy & Consent Rules

* No real payments or addresses stored by GiftLink.
* Recipient must confirm receipt before points are awarded.
* Off-list gifts require approval (optional per Space).
* Private notes (visible only to you) vs. public notes (visible to others).

---

## 🧩 Edge Cases

* **Price changes:** point value stays locked from purchase time.
* **Out of stock:** auto-flag with suggestion for similar items.
* **Duplicate reservations:** time-boxed to prevent overlap.
* **Returns:** points placed on hold or reversed.
* **Abandoned reservations:** expire automatically; item returns to wishlist.

---

## 🔔 Notifications

* When a new high-priority item is added.
* Reservation expiring soon.
* Delivery reminders and confirmation prompts.
* New or expiring Point Shop rewards.
* Occasion reminders (birthdays, holidays, etc.).

---

## 🏆 Gamification (Optional)

* **Streaks:** consecutive gifting months earn bonus points.
* **Badges:** “Thoughtful Giver,” “Early Bird,” etc.
* **Milestones:** celebrate total points with confetti + optional memory notes.

---

## ♿ Accessibility & Design Principles

* Calm and intuitive — designed to feel native to Apple ecosystems.
* Tokens for all color, spacing, and typography (no hardcoded styles).
* Keyboard and screen-reader friendly.
* Use of skeleton loaders instead of spinners for a polished experience.
* Focus indicators always visible.

---

## 🧠 For Developers & Agents

* **AGENT.md** — code behavior & commit rules.
* **DESIGN.md** — visual rules & tokens.
* **COMPONENTS.md** — how to spec every component.
* **CONTRIBUTING.md** — branch and PR etiquette.

**Non-negotiables:**

* Use only tokens from `src/ui/tokens/tokens.css`.
* Implement full state coverage (hover, focus, active, etc.).
* Document each new component with an example.

---

## 🧍 Sample User Stories

* As a giver, I can reserve a gift so others don’t duplicate it.
* As a recipient, I can confirm receipt to grant points.
* As a team admin, I can require approval for off-list gifts.
* As a user, I can choose between **Price-Indexed** or **Sentiment-Valued** points when creating a Space.
* As a family member, I can redeem points in a shared Point Shop.

---

## 🧩 MVP Features

* Create Space (Pair, Family, or Team) with point configuration.
* Add wishlist items via URL fetcher.
* Reserve → Purchase → Deliver → Confirm flow.
* Earn and spend points in Point Shop.
* Track history via Ledger.
* Include essential notifications and accessibility standards.

---

🚀 Quickstart

1. `npm install`
2. `npm run dev`
3. Visit [http://localhost:5173](http://localhost:5173)
4. Ensure global styles are imported in `App.tsx`:

   ```tsx
   import './ui/tokens/tokens.css';
   import './ui/styles/base.css';
   ```

---

> **GiftLink** brings transparency and delight to gifting. Whether it’s between partners, family, or colleagues, every thoughtful action earns appreciation — one point at a time.
