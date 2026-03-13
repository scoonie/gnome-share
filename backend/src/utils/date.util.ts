import dayjs, { ManipulateType } from "dayjs";

export function parseRelativeDateToAbsolute(relativeDate: string) {
  if (relativeDate == "never") return dayjs(0).toDate();

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

export function stringToTimespan(value: string): Timespan {
  const [time, unit] = value.split(" ");
  return {
    value: parseInt(time),
    unit: unit as Timespan["unit"],
  };
}

export function timespanToString(timespan: Timespan) {
  return `${timespan.value} ${timespan.unit}`;
}
