function normalizeVietnamese(text) {
    if (!text || !text.trim()) return "";
    let s = text.replace(/đ/g, "d").replace(/Đ/g, "d");
    s = s.normalize("NFD");
    s = s.replace(/\p{Mn}/gu, "");
    s = s.normalize("NFC");
    return s.toLowerCase().trim();
}

console.log("norm(a\\u1ab0):", JSON.stringify(normalizeVietnamese("a\u1ab0")));
console.log("norm(\\u0301):", JSON.stringify(normalizeVietnamese("\u0301")));
console.log("norm(   ):", JSON.stringify(normalizeVietnamese("   ")));

function compareOrdinalIgnoreCase(a, b) {
    const la = a.toUpperCase();
    const lb = b.toUpperCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
}

console.log("compare(Á Hotel, Z Hotel):", compareOrdinalIgnoreCase("Á Hotel", "Z Hotel"));
console.log("Á charcode:", "Á".charCodeAt(0), "Z charcode:", "Z".charCodeAt(0));
