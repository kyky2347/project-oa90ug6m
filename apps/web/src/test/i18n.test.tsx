import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageSwitch } from "@/components/language-switch";
import {
  formatDate,
  formatNumber,
  setLocale,
  translate,
  useI18n,
} from "@/lib/i18n";
import { usePulseStore } from "@/lib/store";
import chinese from "@/lib/locales/zh-CN.json";
import { businesses, labels } from "@/lib/types";

function Readout() {
  const { t, population } = useI18n();
  return (
    <>
      <LanguageSwitch />
      <p>{t("Demand Potential")}</p>
      <p>{population(9234)}</p>
    </>
  );
}

beforeEach(() => {
  cleanup();
  setLocale("en");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLocale("en");
});

describe("English and Simplified Chinese", () => {
  it("switches immediately, persists and leaves investigation state intact", () => {
    usePulseStore.setState({
      business: "gym",
      selected: "88194ad267fffff",
      minimum: 35,
    });
    const prior = usePulseStore.getState();
    render(<Readout />);
    fireEvent.click(screen.getByRole("button", { name: "简体中文" }));
    expect(screen.getByText("需求潜力")).toBeVisible();
    expect(screen.getByText("9,200")).toBeVisible();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(localStorage.getItem("pulse-language-v1")).toBe("zh-CN");
    expect(usePulseStore.getState()).toBe(prior);
    cleanup();
    render(<Readout />);
    expect(screen.getByText("需求潜力")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Demand Potential")).toBeVisible();
    expect(document.documentElement.lang).toBe("en");
  });

  it("works when the browser blocks persistent storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Readout />);
    fireEvent.click(screen.getByRole("button", { name: "简体中文" }));
    expect(screen.getByText("需求潜力")).toBeVisible();
  });

  it("uses English for an unsupported saved preference", () => {
    localStorage.setItem("pulse-language-v1", "unexpected");
    render(<Readout />);
    expect(screen.getByText("Demand Potential")).toBeVisible();
  });

  it("covers every business and component label", () => {
    for (const label of [
      ...businesses.map((b) => b.name),
      ...Object.values(labels),
    ]) {
      expect(translate("zh-CN", label)).toMatch(/[\u3400-\u9fff]/);
      expect(translate("en", label)).toBe(label);
    }
    expect(
      Object.values(chinese).every((value) => value.trim().length > 0),
    ).toBe(true);
  });

  it("translates server explanations and comparisons without changing their evidence", () => {
    const summary =
      "This area is supported by white space, demand potential. The main constraint is operational context.";
    expect(translate("zh-CN", summary)).toBe(
      "该区域的主要支持因素是供给缺口、需求潜力。主要限制是运营环境。",
    );
    expect(translate("en", summary)).toBe(summary);
    expect(
      translate(
        "zh-CN",
        "Site A has stronger access. Site B has stronger broadly similar signals.",
      ),
    ).toBe(
      "区域 A 较强的方面：交通可达性。区域 B 较强的方面：整体相近的指标。",
    );
  });

  it("retains source identifiers and geographic names verbatim", () => {
    for (const value of [
      "ldn-20260911T130817-f16e80",
      "East India Dock Road & Chrisp Street, Poplar.",
      "Transport for London",
    ]) {
      expect(translate("zh-CN", value)).toBe(value);
    }
    expect(translate("zh-CN", "Inspect East India Dock Road")).toBe(
      "查看 East India Dock Road",
    );
    expect(translate("zh-CN", "Demand Potential weight")).toBe("需求潜力权重");
  });

  it("formats dates in UTC and keeps missing evidence explicit", () => {
    expect(formatDate("en", "2026-09-11T00:30:00Z")).toBe("11 Sept 2026");
    expect(formatDate("zh-CN", "2026-09-11T00:30:00Z")).toBe("2026年9月11日");
    expect(formatDate("zh-CN", null)).toBe("发布者未提供");
    expect(formatNumber("zh-CN", undefined)).toBe("暂不可用");
    expect(formatNumber("zh-CN", 0)).toBe("0");
  });
});
