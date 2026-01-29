import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareRunModal } from "./share-run-modal";
import "@testing-library/jest-dom";
import { dbUtils } from "@/lib/dbUtils";
import { useToast } from "@/hooks/use-toast";

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));

// Mock the fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ shareableLink: "https://mock.link/run123" }),
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

describe("ShareRunModal", () => {
  const mockOnClose = vi.fn();
  let toastSpy: any;
  const runProps = {
    runId: "run123",
    runDate: "2025-07-16",
    isOpen: true,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (dbUtils.getCurrentUser as any).mockResolvedValue({ id: 456 });
    toastSpy = vi.fn();
    (useToast as any).mockReturnValue({ toast: toastSpy });
  });

  it("renders correctly when open", () => {
    render(<ShareRunModal {...runProps} />);
    expect(screen.getByText(/Share Your Run from 2025-07-16!/i)).toBeInTheDocument();
    expect(screen.getByText(/Share your run summary/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Share Link/i })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<ShareRunModal {...runProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("generates a shareable link when 'Generate Share Link' is clicked", async () => {
    render(<ShareRunModal {...runProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/share-run",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        })
      );
    });

    const fetchCall = (global.fetch as any).mock.calls.find((call: any[]) => call[0] === "/api/share-run");
    const requestBody = JSON.parse(fetchCall?.[1]?.body ?? "{}");
    expect(requestBody).toMatchObject({ runId: "run123", userId: "456" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/run123")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
    });
  });

  it("copies the shareable link to clipboard", async () => {
    render(<ShareRunModal {...runProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://mock.link/run123")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://mock.link/run123");
      expect(toastSpy).toHaveBeenCalled();
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

    render(<ShareRunModal {...runProps} />);
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate Share Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Could not generate share link. Please try again./i)).toBeInTheDocument();
    });
  });
});
