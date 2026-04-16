import { describe, expect, it } from "vitest";
import {
  formatMonitorTimeout,
  getMonitorMetaSummary,
  getMonitorToolInfo,
  summarizeMonitorTarget,
} from "../../../../apps/monitor/src/utils/monitor";

describe("monitor utils", () => {
  it("extracts the public Monitor tool fields used by timeline and detail views", () => {
    expect(
      getMonitorToolInfo({
        command: "tail -f deploy.log",
        description: "errors in deploy.log",
        persistent: true,
        timeout_ms: 30000,
      }),
    ).toEqual({
      command: "tail -f deploy.log",
      description: "errors in deploy.log",
      persistent: true,
      timeoutMs: 30000,
    });
  });

  it("prefers description over command when summarizing a monitor target", () => {
    expect(
      summarizeMonitorTarget({
        command: "tail -f deploy.log",
        description: "errors in deploy.log",
      }),
    ).toBe("errors in deploy.log");
  });

  it("falls back to a truncated command when description is missing", () => {
    expect(
      summarizeMonitorTarget(
        {
          command: "while true; do tail -n 50 /var/log/app.log | grep ERROR; sleep 5; done",
        },
        36,
      ),
    ).toBe("while true; do tail -n 50 /var/lo...");
  });

  it("formats monitor timeout values for UI display", () => {
    expect(formatMonitorTimeout(500)).toBe("500ms");
    expect(formatMonitorTimeout(30_000)).toBe("30s");
    expect(formatMonitorTimeout(90_000)).toBe("1m 30s");
  });

  it("builds the monitor meta summary used by timeline and detail views", () => {
    expect(
      getMonitorMetaSummary({
        persistent: true,
        timeout_ms: 30_000,
      }),
    ).toBe("persistent / 30s timeout");
  });
});
