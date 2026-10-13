function compareGuid(g1, g2) {
    const b1 = Buffer.from(g1.replace(/-/g, ''), 'hex');
    const b2 = Buffer.from(g2.replace(/-/g, ''), 'hex');
    const a1 = b1.readUInt32LE(0);
    const a2 = b2.readUInt32LE(0);
    if (a1 !== a2) return a1 < a2 ? -1 : 1;
    const valB1 = b1.readUInt16LE(4);
    const valB2 = b2.readUInt16LE(4);
    if (valB1 !== valB2) return valB1 < valB2 ? -1 : 1;
    const c1 = b1.readUInt16LE(6);
    const c2 = b2.readUInt16LE(6);
    if (c1 !== c2) return c1 < c2 ? -1 : 1;
    for (let i = 8; i < 16; i++) {
        if (b1[i] !== b2[i]) return b1[i] < b2[i] ? -1 : 1;
    }
    return 0;
}

const g1 = "11111111-1111-1111-1111-111111111111";
const g2 = "22222222-2222-2222-2222-222222222222";
const g8 = "88888888-8888-8888-8888-888888888888";
console.log("g1 vs g2:", compareGuid(g1, g2));
console.log("g2 vs g8:", compareGuid(g2, g8));
console.log("g8 vs g1:", compareGuid(g8, g1));
