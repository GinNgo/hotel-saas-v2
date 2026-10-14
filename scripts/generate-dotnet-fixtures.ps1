$greek1 = [string][char]0x1F80
$greek2 = [string][char]0x1F88
$cGreek = [StringComparer]::OrdinalIgnoreCase.Compare($greek1, $greek2)
$cStrasse = [StringComparer]::OrdinalIgnoreCase.Compare('Straße', 'STRASSE')
$cAscii = [StringComparer]::OrdinalIgnoreCase.Compare('Hotel A', 'hotel a')
$cAccent = [StringComparer]::OrdinalIgnoreCase.Compare('Z Hotel', 'Á Hotel')
$cIdentical = [StringComparer]::OrdinalIgnoreCase.Compare('Khách Sạn Central Đà Nẵng', 'Khách Sạn Central Đà Nẵng')

$g1 = [Guid]'00000001-0000-0000-0000-000000000000'
$g2 = [Guid]'00000100-0000-0000-0000-000000000000'
$cG1 = $g1.CompareTo($g2)

$out = @"
================================================================================
RUNTIME-BACKED .NET COMPARATOR FIXTURES & BEHAVIORAL EVIDENCE
================================================================================
Generated via .NET Runtime (PowerShell CoreCLR)
Environment: Windows / .NET CLR

1. Greek Titlecase/Uppercase Equivalence (Counterexample to naive JS oracle):
   Input A: U+1F80 (Greek small letter alpha with psili and ypogegrammeni)
   Input B: U+1F88 (Greek capital letter alpha with psili and prosgegrammeni)
   [StringComparer]::OrdinalIgnoreCase.Compare(U+1F80, U+1F88) = $cGreek
   Note: In .NET, these compare equal (0) under full invariant Unicode casing tables.
   In JS ECMAScript, whole-string expansion differences yield -1.
   Production requirement: Backend must use native StringComparer.OrdinalIgnoreCase.

2. German Sharp S vs Uppercase SS (Non-expanding Ordinal Comparison Sign):
   Input A: 'Straße'
   Input B: 'STRASSE'
   [StringComparer]::OrdinalIgnoreCase.Compare('Straße', 'STRASSE') = $cStrasse (Positive Sign: > 0)
   Note: Positive sign confirms that 'ß' (0xDF = 223) does not expand to 'SS' (0x53 = 83).
   'Straße' and 'STRASSE' are distinct and do NOT collapse to equal.

3. ASCII Case Insensitivity:
   Input A: 'Hotel A'
   Input B: 'hotel a'
   [StringComparer]::OrdinalIgnoreCase.Compare('Hotel A', 'hotel a') = $cAscii (0)

4. Accent vs ASCII Code Point Ordering:
   Input A: 'Z Hotel' (ASCII 'Z' = 0x5A = 90)
   Input B: 'Á Hotel' (Latin 'Á' = 0xC1 = 193)
   [StringComparer]::OrdinalIgnoreCase.Compare('Z Hotel', 'Á Hotel') = $cAccent (Negative Sign: < 0)
   Note: Proves ASCII uppercase precedes accented characters under OrdinalIgnoreCase.

5. Identical Strings:
   Input A: 'Khách Sạn Central Đà Nẵng'
   Input B: 'Khách Sạn Central Đà Nẵng'
   [StringComparer]::OrdinalIgnoreCase.Compare(A, B) = $cIdentical (0)

6. Numeric Guid Group Ordering:
   Guid A: 00000001-0000-0000-0000-000000000000 (Group 1 integer = 1)
   Guid B: 00000100-0000-0000-0000-000000000000 (Group 1 integer = 256)
   Guid.CompareTo(Guid B) = $cG1 (Negative Sign: < 0)
================================================================================
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("C:\Dev\hotel-saas-v2\docs\agent-coordination\evidence\dotnet-comparator-fixtures.txt", $out, $utf8NoBom)
Write-Host "Created dotnet-comparator-fixtures.txt successfully!"
