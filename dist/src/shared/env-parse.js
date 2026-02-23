const TRUE_VALUES = new Set(["true", "1", "yes"]);
const FALSE_VALUES = new Set(["false", "0", "no"]);
export function parseBooleanStrict(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) {
        return true;
    }
    if (FALSE_VALUES.has(normalized)) {
        return false;
    }
    throw new Error(`invalid boolean value: ${value}`);
}
export function parseBooleanLike(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    return TRUE_VALUES.has(value.trim().toLowerCase());
}
