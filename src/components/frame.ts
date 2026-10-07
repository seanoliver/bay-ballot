export const FRAME = "mx-auto w-full max-w-[1440px] px-4";
// max-w-3xl must stay equal to the list column's 48rem cap in BallotView.
export const COLUMN = "mx-auto w-full max-w-3xl pt-4 pb-10 lg:pt-6";
// self-start: a grid item stretches to the row (the whole list), which made the sticky box a full
// viewport tall even around a short card, so it left the screen before the card's bottom met the footer.
export const PANE = "scrollbar-thin hidden lg:sticky lg:top-0 lg:block lg:self-start lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-6";
