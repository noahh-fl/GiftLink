import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SpaceWishlist from "../SpaceWishlist";
import { apiFetch } from "../../utils/api";

vi.mock("../../utils/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => ({
      space: { id: 1, name: "Test space", mode: "price" },
      refreshSpace: vi.fn(),
    }),
  };
});

const mockedApiFetch = vi.mocked(apiFetch);

describe("SpaceWishlist", () => {
  beforeEach(() => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ gifts: undefined }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty state when no gifts are available", async () => {
    render(<SpaceWishlist />);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/wishlist?spaceId=1");
    });

    const emptyState = await screen.findByText("No items yet. Add your first idea.");
    expect(emptyState).toBeTruthy();
  });
});
