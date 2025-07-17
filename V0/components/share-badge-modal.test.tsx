import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { vi } from "vitest";
import "@testing-library/jest-dom";

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
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/share-badge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ badgeId: "badge123", userId: "current_user_id" }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/badge123")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
    });
  });

  it("copies the shareable link to clipboard", async () => {
    render(<ShareBadgeModal {...badgeProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/badge123")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://mock.link/badge123");
    expect(window.alert).toHaveBeenCalledWith("Link copied to clipboard!"); // Assuming alert is used for feedback
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
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Could not generate share link. Please try again./i)).toBeInTheDocument();
    });
  });
});
