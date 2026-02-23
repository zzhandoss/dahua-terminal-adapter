export function ok(data) {
    return { success: true, data };
}
export function fail(code, message, data) {
    return {
        success: false,
        error: data === undefined ? { code, message } : { code, message, data }
    };
}
