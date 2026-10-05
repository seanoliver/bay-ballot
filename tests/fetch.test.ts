import { describe, expect, it } from "vitest";
import { htmlToText } from "@/pipeline/fetch";

describe("htmlToText", () => {
  it("drops scripts, styles and nav, keeps body text", () => {
    const html = `<html><head><style>.x{}</style></head><body><nav>Menu</nav>
      <h2>Prop B</h2><p>Vote <b>No</b>. A public bank is risky.</p><script>alert(1)</script></body></html>`;
    expect(htmlToText(html)).toBe("Prop B\nVote No. A public bank is risky.");
  });

  it("puts list items on separate lines", () => {
    expect(htmlToText("<ul><li>Prop A: Yes</li><li>Prop B: No</li></ul>")).toBe("Prop A: Yes\nProp B: No");
  });

  it("turns <br> into a line break", () => {
    expect(htmlToText("<p>Prop A<br>Yes<br/>Prop B<br>No</p>")).toBe("Prop A\nYes\nProp B\nNo");
  });

  it("separates table cells with ' | ' and rows with newlines", () => {
    const html = `<table><tr><th>Measure</th><th>Rec</th></tr><tr><td>Prop A</td><td>Yes</td></tr></table>`;
    expect(htmlToText(html)).toBe("Measure | Rec\nProp A | Yes");
  });

  it("does not split words at inline elements", () => {
    expect(htmlToText("<p>Vote <b>No</b> on <a href='#'>Prop</a>B, and un<i>believ</i>able</p>")).toBe(
      "Vote No on PropB, and unbelievable",
    );
  });

  it("collapses source newlines inside a paragraph", () => {
    expect(htmlToText("<p>Vote\n   No on\n Prop B</p>")).toBe("Vote No on Prop B");
  });

  it("decodes entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry&rsquo;s&nbsp;guide</p>")).toBe("Tom & Jerry’s guide");
  });

  it("keeps img alt text in brackets", () => {
    expect(htmlToText(`<p>Prop A <img alt="YES" src="y.png"> Prop B <img alt="" src="x.png"><img alt="NO"></p>`)).toBe(
      "Prop A [YES] Prop B [NO]",
    );
  });

  it("removes footer and svg", () => {
    expect(htmlToText("<body><p>Keep</p><svg><text>icon</text></svg><footer>Copyright</footer></body>")).toBe("Keep");
  });
});
