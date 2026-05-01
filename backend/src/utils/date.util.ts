import dayjs, { ManipulateType } from "dayjs";

export function parseRelativeDateToAbsolute(relativeDate: string) {
  if (relativeDate === "never") {
    throw new Error("Permanent shares are not supported");
  }

  return dayjs()
    .add(
      parseInt(relativeDate.split("-")[0]),
      relativeDate.split("-")[1] as ManipulateType,
    )
    .toDate();
}

type Timespan = {
  value: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
};

const VALID_TIMESPAN_UNITS: ReadonlySet<Timespan["unit"]> = new Set([
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
]);

export function stringToTimespan(value: string): Timespan {
  const [time, unit] = value.trim().split(/\s+/);
  return {
    value: parseInt(time),
    unit: unit as Timespan["unit"],
  };
}

export function isValidTimespan(value: string): boolean {
  if (typeof value !== "string") return false;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) return false;

  const [time, unit] = parts;
  if (!/^\d+$/.test(time)) return false;
  return VALID_TIMESPAN_UNITS.has(unit as Timespan["unit"]);
}

export function timespanToString(timespan: Timespan) {
  return `${timespan.value} ${timespan.unit}`;
}
