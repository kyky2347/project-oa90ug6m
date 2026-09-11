import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserver);
