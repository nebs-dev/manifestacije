"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.uniqueSlug = uniqueSlug;
function slugify(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
async function uniqueSlug(base, exists) {
    const root = slugify(base) || "event";
    let candidate = root;
    let n = 2;
    while (await exists(candidate)) {
        candidate = `${root}-${n++}`;
    }
    return candidate;
}
