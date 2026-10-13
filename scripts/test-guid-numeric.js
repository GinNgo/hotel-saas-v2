function compareGuidNumeric(g1, g2) {
    const p1 = g1.split('-');
    const p2 = g2.split('-');

    // Group 1: 32-bit unsigned integer (_a)
    const a1 = parseInt(p1[0], 16);
    const a2 = parseInt(p2[0], 16);
    if (a1 !== a2) return a1 < a2 ? -1 : 1;

    // Group 2: 16-bit unsigned integer (_b)
    const b1 = parseInt(p1[1], 16);
    const b2 = parseInt(p2[1], 16);
    if (b1 !== b2) return b1 < b2 ? -1 : 1;

    // Group 3: 16-bit unsigned integer (_c)
    const c1 = parseInt(p1[2], 16);
    const c2 = parseInt(p2[2], 16);
    if (c1 !== c2) return c1 < c2 ? -1 : 1;

    // Groups 4 and 5: 8 individual bytes (_d through _k) in big-endian hex order
    const rest1 = p1[3] + p1[4];
    const rest2 = p2[3] + p2[4];
    for (let i = 0; i < 16; i += 2) {
        const byte1 = parseInt(rest1.substring(i, i + 2), 16);
        const byte2 = parseInt(rest2.substring(i, i + 2), 16);
        if (byte1 !== byte2) return byte1 < byte2 ? -1 : 1;
    }
    return 0;
}

const gA = '00000001-0000-0000-0000-000000000000';
const gB = '00000100-0000-0000-0000-000000000000';
console.log("compareGuidNumeric(gA, gB):", compareGuidNumeric(gA, gB));
