import {
  format,
  isToday,
  isThisWeek,
  isThisYear,
  differenceInMinutes,
} from "date-fns";

export const formatTimestamp = (timestamp: string | Date) => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();

  if (differenceInMinutes(now, date) === 0) {
    return { date: "Today", time: "Just now" };
  }

  if (isToday(date)) {
    return { date: "Today", time: format(date, "p") };
  } else if (isThisWeek(date)) {
    return { date: format(date, "EEEE"), time: format(date, "p") };
  } else if (isThisYear(date)) {
    return { date: format(date, "MMM d"), time: format(date, "p") };
  } else {
    return { date: format(date, "MMM d, yyyy"), time: format(date, "p") };
  }
};
