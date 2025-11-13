const resolvedTimeZone = (() => {
  try {
    const options = Intl.DateTimeFormat().resolvedOptions();
    return options && options.timeZone ? options.timeZone : 'UTC';
  } catch (error) {
    return 'UTC';
  }
})();

const ISO_LIKE_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const HAS_TIMEZONE_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

export const getUserTimeZone = () => resolvedTimeZone;

export const parseFlexibleTimestamp = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }

    let candidate = trimmed.replace(' ', 'T');
    if (ISO_LIKE_NO_TZ_REGEX.test(candidate) && !HAS_TIMEZONE_REGEX.test(candidate)) {
      candidate = `${candidate}Z`;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const formatInUserTimeZone = (value, options = {}) => {
  const timestamp = parseFlexibleTimestamp(value);
  if (!timestamp) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone: resolvedTimeZone,
      ...options
    });
    return formatter.format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toLocaleString();
  }
};

export const formatDateTimeForDisplay = (value, options = {}) =>
  formatInUserTimeZone(value, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...options
  });

