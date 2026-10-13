# Sourcing guide descriptions

Investigated 2026-10-12 (Pacific), while rewriting every guide's description (#52).

## Context

Each guide page shows the guide's `description` from `data/guides/<guide>.yml`. The old descriptions were category labels. The new ones say who the guide is, what it focuses on, and how it decides endorsements, each claim sourced. Per-guide sources are in `docs/guide-description-sources.md`.

## Key findings

- **Process is the hardest fact to source.** Many guides publish how they decide (a 60% member vote, an endorsement committee, a central committee vote). Most county Democratic committees publish it; most unions, Republican committees, and advocacy groups don't, so their descriptions stop at who they are and what they focus on.
- **Old descriptions had errors.** EBHO doesn't endorse candidates (it is a 501(c)(3) and takes positions on measures only). Housing Action Coalition was founded in 1999. California Working Families Party isn't on the California ballot, so "minor party" was dropped. The San Francisco Bay Guardian stopped printing in 2014.
- **Founding years conflict often.** Wikipedia's Courage California article says 2005 in its text and 2006 in its infobox; the group's About page says 2006. Sources also disagree for the League of Women Voters of the Bay Area (1957, 1959, or 1961), the Press Democrat (1857 or 1897), and SF Building Trades (1893 or 1896). A year goes in only when the organization's own page or two independent sources agree.
- **"Official" party committee:** county central committees are created by the California Elections Code, so "official Democratic/Republican Party committee for X County" is accurate even when a committee's site doesn't use the word.
- **Ownership changes:** the Los Altos Town Crier reported on October 9, 2026 that Weeklys Media Group bought it, so "locally owned" was dropped.

## How it works

- Research ran in six batches of 21 guides, each writing a description and a URL for every claim. A second pass checked every claim against its cited page and corrected 10 descriptions.
- `validateElection` (`src/lib/data.ts`) fails `npm run validate` when a description is empty, over `GUIDE_DESCRIPTION_MAX` (250) characters, or has an em or en dash.

## Gotchas

- Several sites block scripted fetches with 403s: sfbike.org, sierraclub.org, couragecalifornia.org, sflaborcouncil.org, ebar.com, acdems.org, apademcaucus.org, Planned Parenthood Northern California Action Fund, and the San Mateo Daily Journal's endorsement pages. The Wayback Machine (`web.archive.org/web/2026/<url>`) or a real browser reads them.
- An organization's self-description is a claim, not a fact. Superlatives ("oldest", "largest") and political labels ("progressive") are written as "describes itself as" or "says".
- A description goes stale when an organization changes. Re-check the sources file when a guide is added to a new area or its site changes.
