function osaDistance(s1, s2) {
    const l1 = s1.length;
    const l2 = s2.length;
    const d = Array.from({length: l1 + 1}, () => Array(l2 + 1).fill(0));
    for (let i = 0; i <= l1; i++) d[i][0] = i;
    for (let j = 0; j <= l2; j++) d[0][j] = j;

    for (let i = 1; i <= l1; i++) {
        for (let j = 1; j <= l2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,      // deletion
                d[i][j - 1] + 1,      // insertion
                d[i - 1][j - 1] + cost // substitution
            );
            if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
            }
        }
    }
    return d[l1][l2];
}

console.log("centxralz -> da:", osaDistance("centxralz", "da"));
console.log("centxralz -> nang:", osaDistance("centxralz", "nang"));
console.log("centxralz -> chau:", osaDistance("centxralz", "chau"));
console.log("centxralz -> central:", osaDistance("centxralz", "central"));
console.log("centxralz -> khach:", osaDistance("centxralz", "khach"));
console.log("centxralz -> san:", osaDistance("centxralz", "san"));
console.log("nhxtrangg -> nhatrang:", osaDistance("nhxtrangg", "nhatrang"));
