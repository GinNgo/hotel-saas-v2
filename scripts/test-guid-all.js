function compareGuid(g1, g2) {
    const p1 = g1.split('-');
    const p2 = g2.split('-');

    const a1 = parseInt(p1[0], 16);
    const a2 = parseInt(p2[0], 16);
    if (a1 !== a2) return a1 < a2 ? -1 : 1;

    const b1 = parseInt(p1[1], 16);
    const b2 = parseInt(p2[1], 16);
    if (b1 !== b2) return b1 < b2 ? -1 : 1;

    const c1 = parseInt(p1[2], 16);
    const c2 = parseInt(p2[2], 16);
    if (c1 !== c2) return c1 < c2 ? -1 : 1;

    const rest1 = p1[3] + p1[4];
    const rest2 = p2[3] + p2[4];
    for (let i = 0; i < 16; i += 2) {
        const byte1 = parseInt(rest1.substring(i, i + 2), 16);
        const byte2 = parseInt(rest2.substring(i, i + 2), 16);
        if (byte1 !== byte2) return byte1 < byte2 ? -1 : 1;
    }
    return 0;
}

const tests = [
    ['00000001-0000-0000-0000-000000000000', '00000100-0000-0000-0000-000000000000'],
    ['00000000-0001-0000-0000-000000000000', '00000000-0100-0000-0000-000000000000'],
    ['00000000-0000-0001-0000-000000000000', '00000000-0000-0100-0000-000000000000'],
    ['00000000-0000-0000-0001-000000000000', '00000000-0000-0000-0100-000000000000'],
    ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010'],
    ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
    ['22222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888']
];

tests.forEach(([gA, gB], idx) => {
    const res = compareGuid(gA, gB);
    console.log(`Test ${idx + 1}: ${res} (Expected -1) -> ${res === -1 ? 'PASS' : 'FAIL'}`);
});
