// IST is UTC+5:30 with no DST, so plain arithmetic works and server/browser always agree.
const IST_OFFSET_MS = 330 * 60_000;

const shifted = (ms: number) => new Date(ms + IST_OFFSET_MS);

export const istHour = (ms: number) => shifted(ms).getUTCHours();

/** YYYY-MM-DD of the IST day containing `ms`. */
export const istDay = (ms: number) => shifted(ms).toISOString().slice(0, 10);

/** Epoch ms of `hour`:00 IST on the IST day containing `ms`. */
export const atIstHour = (ms: number, hour: number) => {
  const d = shifted(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour) - IST_OFFSET_MS;
};
