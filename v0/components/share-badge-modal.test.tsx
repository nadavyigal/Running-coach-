import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { vi } from "vitest";
import "@testing-library/jest-dom";
import { dbUtils } from "@/lib/dbUtils";
import { toast } from "@/components/ui/use-toast";

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

// Mock the fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ shareableLink: "https://mock.link/badge123" }),
  }) as Promise<Response>
);

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

// Mock window.alert
global.alert = vi.fn();

describe("ShareBadgeModal", () => {
  const mockOnClose = vi.fn();
  const badgeProps = {
    badgeId: "badge123",
    badgeName: "First Run",
    isOpen: true,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (dbUtils.getCurrentUser as any).mockResolvedValue({ id: 123 });
  });

  it("renders correctly when open", () => {
    render(<ShareBadgeModal {...badgeProps} />);
    expect(screen.getByText(/Share Your First Run Badge!/i)).toBeInTheDocument();
    expect(screen.getByText(/Share your awesome achievement/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Share Link/i })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<ShareBadgeModal {...badgeProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("generates a shareable link when 'Generate Share Link' is clicked", async () => {
    render(<ShareBadgeModal {...badgeProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/share-badge",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        })
      );
    });

    const fetchCall = (global.fetch as any).mock.calls.find((call: any[]) => call[0] === "/api/share-badge");
    const requestBody = JSON.parse(fetchCall?.[1]?.body ?? "{}");
    expect(requestBody).toMatchObject({ badgeId: "badge123", userId: 123 });

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/badge123")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
    });
  });

  it("copies the shareable link to clipboard", async () => {
    render(<ShareBadgeModal {...badgeProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/badge123")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://mock.link/badge123");
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied!" }));
    });
  });

  it("displays an error message if link generation fails", async () => {
    // Mock fetch to return an error
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Internal Server Error" }),
      }) as Promise<Response>
    );

    render(<ShareBadgeModal {...badgeProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
    });
  });
});
