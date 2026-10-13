function charToUpperInvariantCode(code) {
    const ch = String.fromCharCode(code);
    const upper = ch.toUpperCase();
    if (upper.length === 1) {
        return upper.charCodeAt(0);
    }
    return code;
}

function compareOrdinalIgnoreCase(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ca = charToUpperInvariantCode(a.charCodeAt(i));
        const cb = charToUpperInvariantCode(b.charCodeAt(i));
        if (ca !== cb) {
            return ca < cb ? -1 : 1;
        }
    }
    if (a.length !== b.length) {
        return a.length < b.length ? -1 : 1;
    }
    return 0;
}

const tests = [
    ['Straße', 'STRASSE', 1],
    ['Z Hotel', 'Á Hotel', -1],
    ['Hotel A', 'hotel a', 0],
    ['Khách Sạn Biển Đông Đà Nẵng', 'Khách Sạn Central Đà Nẵng', -1]
];

tests.forEach(([s1, s2, exp], idx) => {
    const res = compareOrdinalIgnoreCase(s1, s2);
    console.log(`Test ${idx + 1} ('${s1}' vs '${s2}'): ${res} (Expected ${exp}) -> ${res === exp ? 'PASS' : 'FAIL'}`);
});
