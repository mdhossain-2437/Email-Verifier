/**
 * Brand constants for Saaf — সাফ — the email verifier.
 *
 * Saaf (Bangla: সাফ) means "clean" or "clear". The product cleans your
 * email list: dead addresses out, real ones in.
 *
 * Single source of truth for brand name, taglines, social handles, and
 * builder bio. Imported by PublicLayout, BuilderPage, meta tags, and
 * the JSON-LD blocks injected into index.html.
 */

export const BRAND_NAME = "Saaf";
export const BRAND_BANGLA = "সাফ";
// Primary production domain. The product also resolves at the legacy
// `email-verifier-ruby.vercel.app` and the project-default
// `email-verifier-mdhossain2437-9715s-projects.vercel.app` aliases — those
// are CORS-allowed but NOT canonical. SEO + sitemap + structured-data
// references must use this single primary URL so Google deduplicates the
// duplicates correctly.
export const BRAND_DOMAIN = "saaf-mail.vercel.app";
export const BRAND_URL = `https://${BRAND_DOMAIN}`;

export const BRAND_TAGLINE = "Clean email lists, fast.";
export const BRAND_HERO_LINE_A = "Stop sending email";
export const BRAND_HERO_LINE_B = "to dead addresses.";
export const BRAND_DESCRIPTION =
  "Paste a list. Saaf checks every address against the real mail server. You get a clean CSV back — no dead weight, no bounces. Free tier up to 100,000 addresses per job. Open source, self-host ready.";
export const BRAND_DESCRIPTION_SHORT =
  "Clean your email list against the real mail server. No bounces, no dead weight. Free, open source, self-host ready.";

export const PORTFOLIO_URL = "https://delowarhossain.dev";
export const FOLIO_URL = "https://2027.delowarhossain.dev";
export const GITHUB_PROFILE = "https://github.com/mdhossain-2437";
export const GITHUB_REPO = "https://github.com/mdhossain-2437/Email-Verifier";
export const CONTACT_EMAIL = "hello@delowarhossain.dev";

/**
 * Optional social handles. Empty strings = hide the icon. Set the value
 * when the user provides their handle and the link will light up.
 */
export const SOCIAL_LINKS: Readonly<{
  github: string;
  twitter: string;
  linkedin: string;
  email: string;
  portfolio: string;
}> = {
  github: GITHUB_PROFILE,
  twitter: "",
  linkedin: "",
  email: `mailto:${CONTACT_EMAIL}`,
  portfolio: PORTFOLIO_URL,
};

export interface BuilderBioParagraph {
  heading: string;
  body: string;
}

export interface MilestoneEntry {
  year: string;
  title: string;
  body: string;
}

export interface AwardEntry {
  title: string;
  org: string;
  year: string;
  body: string;
}

/**
 * Bio paragraphs distilled from delowarhossain.dev and 2027.delowarhossain.dev.
 * Plain English, no jargon, written in third person so it reads cleanly inside
 * the "Built by" section.
 */
export const BUILDER_BIO: BuilderBioParagraph[] = [
  {
    heading: "The builder",
    body:
      "Saaf was designed and built end-to-end by Md Delowar Hossain — a creative developer and full-stack engineer based in Joypurhat, Bangladesh. He works at the intersection of editorial design, performance engineering, and AI integration: shipping interfaces that feel premium and turn technical complexity into something clear, useful, and memorable.",
  },
  {
    heading: "How he thinks",
    body:
      "A BA in Political Science gives Delowar a systems-level way of thinking about people, behavior, communication, and product structure. He believes an interface should disappear, leaving only the canvas and the content — and that craft is a long, deliberate climb, not a sprint.",
  },
  {
    heading: "What he ships",
    body:
      "Editorial restraint. Sub-50 ms interactions. 60 fps motion. Lighthouse 95+. Production-grade WebGL, GSAP timelines, custom shaders, and clean engineering handoffs. Saaf is built that way — fast, accessible, honest, and free to use.",
  },
];

export const BUILDER_MILESTONES: MilestoneEntry[] = [
  {
    year: "2017",
    title: "First commission",
    body: "Hand-lettered a logo for a Joypurhat café. Got paid in chai. Decided design was the move.",
  },
  {
    year: "2020",
    title: "Founded The Compiled Thought",
    body: "A one-person studio for editorial-led digital work. First creative-development project shipped six months later.",
  },
  {
    year: "2023",
    title: "First Site of the Day",
    body: "Awwwards SOTD for a kinetic editorial site. Spent the next twelve months refusing every brief that wasn't WebGL.",
  },
  {
    year: "2025",
    title: "Studio scales to four",
    body: "Brought on a motion designer, a 3D artist, and a producer. Shipped Terminal State and Monolith UI back-to-back.",
  },
  {
    year: "2026",
    title: "Saaf goes live",
    body: "Open-source email verifier, designed and engineered solo. Built so smaller teams don't have to pay enterprise prices to clean a list.",
  },
];

export const BUILDER_AWARDS: AwardEntry[] = [
  {
    title: "Honorable Mention",
    org: "Awwwards",
    year: "2024",
    body: "Recognised for a design language merging editorial restraint, technical depth, and interactive storytelling.",
  },
  {
    title: "Best UI Design",
    org: "CSS Design Awards",
    year: "2024",
    body: "Selected for interface precision, calm complexity, and a production-friendly AI workflow experience.",
  },
  {
    title: "#3 Product of the Day",
    org: "Product Hunt",
    year: "2024",
    body: "Ranked for turning a niche creative utility into a sharp, highly shareable product workflow.",
  },
  {
    title: "Site of the Day",
    org: "FWA",
    year: "2024",
    body: "Recognised for combining educational product structure with expressive frontend craft and performance discipline.",
  },
];
