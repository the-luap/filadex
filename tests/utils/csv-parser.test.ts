import { describe, expect, it } from "vitest";
import { escapeCsvField } from "../../server/utils/csv-parser";

describe("escapeCsvField", () => {
  it("leaves plain text and plain numbers alone", () => {
    expect(escapeCsvField("Prusament")).toBe("Prusament");
    expect(escapeCsvField(29.99)).toBe("29.99");
    expect(escapeCsvField("-5")).toBe("-5");
    expect(escapeCsvField(null)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("two\nlines")).toBe('"two\nlines"');
    expect(escapeCsvField("cr\rhere")).toBe('"cr\rhere"');
  });

  // A spool named like a formula would run when the export is opened in a
  // spreadsheet. The apostrophe makes it text; the quoting keeps the CSV valid.
  it("neutralises cells a spreadsheet would treat as a formula", () => {
    expect(escapeCsvField('=HYPERLINK("http://evil/","x")')).toBe(`"'=HYPERLINK(""http://evil/"",""x"")"`);
    expect(escapeCsvField("+1+1")).toBe("'+1+1");
    expect(escapeCsvField("-cmd")).toBe("'-cmd");
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvField("\tx")).toBe("'\tx");
  });
});
