# Money Forward CSV import notes

Money Forward matches attendance type and work pattern names exactly when importing CSV files.

For this project, keep the exported CSV aligned with the registered Money Forward values:

- Attendance type: `平日`, `所定休日`
- Work pattern circle: use `◯` (U+25EF), not `〇` (U+3007)
- Cleaning full-day pattern: `◯終日（掃除）`
- Staff name for employee no. `19`: `笠原 若葉`

If Money Forward reports that a work pattern does not match, compare the character code of similar-looking symbols before changing shift logic.
