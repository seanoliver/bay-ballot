import { readFile } from "node:fs/promises";
import path from "node:path";

// Geist (SIL OFL, src/app/fonts/OFL.txt) as TTF: the image renderer can't read woff2.
const dir = path.join(process.cwd(), "src/app/fonts");
const load = (file: string) => readFile(path.join(dir, file));

export async function shareFonts() {
  const [regular, semibold, bold] = await Promise.all([load("Geist-Regular.ttf"), load("Geist-SemiBold.ttf"), load("Geist-Bold.ttf")]);
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}
