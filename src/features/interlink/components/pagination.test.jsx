import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./pagination";

function renderPagination(props = {}) {
  const handlers = { onPageChange: vi.fn(), onPageSizeChange: vi.fn() };
  render(<Pagination page={1} pageSize={20} total={45} itemCount={20} {...handlers} {...props} />);
  return handlers;
}

describe("Pagination", () => {
  it("shows the range on the first page and disables Previous", () => {
    renderPagination();
    expect(screen.getByText("Showing 1–20 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables Next once page * page_size reaches the total", () => {
    renderPagination({ page: 3, itemCount: 5 });
    expect(screen.getByText("Showing 41–45 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("disables Next when the total fills the page exactly", () => {
    renderPagination({ page: 2, pageSize: 20, total: 40, itemCount: 20 });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("requests the neighbouring pages", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPagination({ page: 2 });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it("offers page sizes 20, 50 and 100", async () => {
    const user = userEvent.setup();
    const { onPageSizeChange } = renderPagination();
    const select = screen.getByLabelText("Per page");
    expect([...select.querySelectorAll("option")].map((option) => option.value)).toEqual(["20", "50", "100"]);
    await user.selectOptions(select, "50");
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("blocks navigation while the next page is loading", () => {
    renderPagination({ page: 2, busy: true });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
