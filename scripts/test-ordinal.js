function charToUpperInvariantCode(code) {
    const ch = String.fromCharCode(code);
    const upper = ch.toUpperCase();
    if (upper.length === 1) {
        return upper.charCodeAt(0);
    }
    return code; // Non-expanding 1-to-1 mapping
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

console.log("compareOrdinalIgnoreCase('Straße', 'STRASSE'):", compareOrdinalIgnoreCase('Straße', 'STRASSE'));
console.log("compareOrdinalIgnoreCase('Z Hotel', 'Á Hotel'):", compareOrdinalIgnoreCase('Z Hotel', 'Á Hotel'));
console.log("compareOrdinalIgnoreCase('Hotel A', 'hotel a'):", compareOrdinalIgnoreCase('Hotel A', 'hotel a'));
