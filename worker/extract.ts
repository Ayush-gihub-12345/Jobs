// Skill / experience / role extraction shared by ingestion and resume matching.

export interface SkillDef {
  name: string;
  aliases?: string[];
  /** Custom regex for ambiguous names (single letters, common words) */
  pattern?: RegExp;
}

export const SKILLS: SkillDef[] = [
  // Languages
  { name: "JavaScript", aliases: ["js"] },
  { name: "TypeScript", aliases: ["ts"] },
  { name: "Python" },
  { name: "Java" },
  { name: "C++", aliases: ["cpp"] },
  { name: "C#", aliases: ["csharp", ".net", "dotnet"] },
  { name: "C", pattern: /\bc programming\b|embedded c\b|\bc\/c\+\+|\bc, c\+\+/i },
  { name: "Go", pattern: /\bgolang\b|\bgo (developer|engineer|programming|services?|code)\b|\(go\)|\bin go\b/i },
  { name: "Rust" },
  { name: "Ruby" },
  { name: "PHP" },
  { name: "Swift" },
  { name: "Kotlin" },
  { name: "Scala" },
  { name: "R", pattern: /\br programming\b|\b(python|sql)(,| and| or) r\b|\br(,| and| or) python\b|\brstudio\b/i },
  { name: "Dart" },
  { name: "Elixir" },
  { name: "Haskell" },
  { name: "Perl" },
  { name: "Objective-C", aliases: ["objective c", "objc"] },
  { name: "SQL" },
  { name: "HTML", aliases: ["html5"] },
  { name: "CSS", aliases: ["css3"] },
  { name: "Bash", aliases: ["shell scripting", "shell"] },
  { name: "MATLAB" },
  { name: "Solidity" },
  // Frontend
  { name: "React", aliases: ["react.js", "reactjs"] },
  { name: "Next.js", aliases: ["nextjs", "next js"] },
  { name: "Vue", aliases: ["vue.js", "vuejs"] },
  { name: "Nuxt", aliases: ["nuxt.js", "nuxtjs"] },
  { name: "Angular", aliases: ["angularjs"] },
  { name: "Svelte", aliases: ["sveltekit"] },
  { name: "Redux" },
  { name: "Tailwind", aliases: ["tailwindcss", "tailwind css"] },
  { name: "Sass", aliases: ["scss"] },
  { name: "Webpack" },
  { name: "Vite" },
  { name: "jQuery" },
  { name: "Three.js", aliases: ["threejs", "webgl"] },
  // Mobile
  { name: "React Native" },
  { name: "Flutter" },
  { name: "Android" },
  { name: "iOS" },
  { name: "SwiftUI" },
  { name: "Jetpack Compose" },
  // Backend
  { name: "Node.js", aliases: ["nodejs", "node js", "node"] },
  { name: "Express", aliases: ["express.js", "expressjs"] },
  { name: "NestJS", aliases: ["nest.js"] },
  { name: "Django" },
  { name: "Flask" },
  { name: "FastAPI" },
  { name: "Spring", aliases: ["spring boot", "springboot"] },
  { name: "Rails", aliases: ["ruby on rails"] },
  { name: "Laravel" },
  { name: "GraphQL" },
  { name: "REST API", aliases: ["rest apis", "restful"] },
  { name: "gRPC" },
  { name: "WebSockets", aliases: ["websocket"] },
  { name: "Microservices" },
  // Databases
  { name: "PostgreSQL", aliases: ["postgres"] },
  { name: "MySQL" },
  { name: "MongoDB", aliases: ["mongo"] },
  { name: "Redis" },
  { name: "SQLite" },
  { name: "Elasticsearch", aliases: ["elastic search"] },
  { name: "Cassandra" },
  { name: "DynamoDB" },
  { name: "Oracle" },
  { name: "SQL Server", aliases: ["mssql"] },
  { name: "Firebase", aliases: ["firestore"] },
  { name: "Supabase" },
  { name: "Snowflake" },
  { name: "BigQuery" },
  { name: "ClickHouse" },
  { name: "Neo4j" },
  // Cloud / DevOps
  { name: "AWS", aliases: ["amazon web services"] },
  { name: "Azure" },
  { name: "GCP", aliases: ["google cloud"] },
  { name: "Cloudflare", aliases: ["cloudflare workers"] },
  { name: "Docker" },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "Terraform" },
  { name: "Ansible" },
  { name: "Jenkins" },
  { name: "CI/CD", aliases: ["cicd", "continuous integration"] },
  { name: "GitHub Actions" },
  { name: "GitLab" },
  { name: "Linux" },
  { name: "Nginx" },
  { name: "Serverless" },
  { name: "Lambda", aliases: ["aws lambda"] },
  { name: "Prometheus" },
  { name: "Grafana" },
  { name: "Datadog" },
  { name: "Helm" },
  // Data / ML / AI
  { name: "Machine Learning", aliases: ["ml"] },
  { name: "Deep Learning" },
  { name: "NLP", aliases: ["natural language processing"] },
  { name: "Computer Vision" },
  { name: "TensorFlow" },
  { name: "PyTorch" },
  { name: "Keras" },
  { name: "scikit-learn", aliases: ["sklearn", "scikit learn"] },
  { name: "Pandas" },
  { name: "NumPy" },
  { name: "Spark", aliases: ["pyspark", "apache spark"] },
  { name: "Hadoop" },
  { name: "Kafka", aliases: ["apache kafka"] },
  { name: "Airflow" },
  { name: "dbt" },
  { name: "ETL" },
  { name: "Data Engineering" },
  { name: "Data Science" },
  { name: "Data Analysis", aliases: ["data analytics"] },
  { name: "LLM", aliases: ["llms", "large language models"] },
  { name: "Generative AI", aliases: ["genai", "gen ai"] },
  { name: "LangChain" },
  { name: "RAG", aliases: ["retrieval augmented generation"] },
  { name: "OpenCV" },
  { name: "Hugging Face", aliases: ["huggingface"] },
  { name: "MLOps" },
  { name: "A/B Testing", aliases: ["ab testing"] },
  { name: "Tableau" },
  { name: "Power BI", aliases: ["powerbi"] },
  { name: "Excel" },
  { name: "Statistics" },
  // Tools & practices
  { name: "Git" },
  { name: "Jira" },
  { name: "Agile", aliases: ["scrum"] },
  { name: "TDD", aliases: ["test driven development"] },
  { name: "Unit Testing", aliases: ["jest", "pytest", "junit"] },
  { name: "Selenium" },
  { name: "Cypress" },
  { name: "Playwright" },
  { name: "QA", aliases: ["quality assurance"] },
  // Design / product
  { name: "Figma" },
  { name: "UI/UX", aliases: ["ui ux", "ux design", "ui design", "user experience"] },
  { name: "Product Management" },
  { name: "Prototyping" },
  { name: "Design Systems", aliases: ["design system"] },
  { name: "Adobe XD" },
  { name: "Photoshop" },
  { name: "Illustrator" },
  // Business
  { name: "SEO" },
  { name: "Digital Marketing" },
  { name: "Content Marketing", aliases: ["content writing"] },
  { name: "Salesforce" },
  { name: "CRM" },
  { name: "HubSpot" },
  { name: "Google Analytics" },
  { name: "Sales" },
  { name: "Recruiting", aliases: ["recruitment", "talent acquisition"] },
  { name: "Accounting" },
  { name: "Financial Analysis", aliases: ["financial modeling"] },
  { name: "Customer Success" },
  { name: "Customer Support" },
  { name: "Project Management" },
  { name: "Communication Skills", pattern: /\b(communication|presentation) skills\b|\bexcellent communicat/i },
  // Security / networking / low-level
  { name: "Cybersecurity", aliases: ["security engineering", "information security", "infosec"] },
  { name: "Penetration Testing", aliases: ["pentesting"] },
  { name: "Networking", aliases: ["tcp/ip"] },
  { name: "Blockchain", aliases: ["web3"] },
  { name: "Embedded Systems", aliases: ["embedded"] },
  { name: "IoT" },
  { name: "Unity" },
  { name: "Unreal Engine", aliases: ["unreal"] },
  { name: "Game Development", aliases: ["game dev"] },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Precompiled matcher: skill name -> regex over lowercase text
const SKILL_PATTERNS: { name: string; re: RegExp }[] = SKILLS.map((s) => {
  if (s.pattern) return { name: s.name, re: s.pattern };
  const terms = [s.name, ...(s.aliases ?? [])].map((t) => escapeRe(t.toLowerCase()));
  return { name: s.name, re: new RegExp(`(?<![a-z0-9+#])(${terms.join("|")})(?![a-z0-9+#])`, "i") };
});

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const { name, re } of SKILL_PATTERNS) {
    if (re.test(lower)) found.push(name);
  }
  return found;
}

export function parseExperience(text: string): { expMin: number | null; expMax: number | null } {
  // "3+ years", "2-4 yrs", "at least 5 years", "minimum of 3 years"
  const m = text.match(/(\d{1,2})\s*(?:\+|\s*(?:-|to|–)\s*(\d{1,2}))?\s*(?:\+\s*)?(?:years?|yrs?)\b/i);
  if (!m) return { expMin: null, expMax: null };
  const a = parseInt(m[1], 10);
  const b = m[2] ? parseInt(m[2], 10) : null;
  if (a > 30) return { expMin: null, expMax: null };
  return { expMin: a, expMax: b !== null && b >= a ? b : null };
}

export type Level = "intern" | "entry" | "mid" | "senior" | "lead";

export function inferLevel(title: string, expMin: number | null): Level {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b|\btrainee\b/.test(t)) return "intern";
  if (/\b(junior|jr\.?|entry|graduate|fresher|associate)\b|\bnew grad\b/.test(t)) return "entry";
  if (/\b(staff|principal|lead|head|director|vp|vice president|architect|manager)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (expMin !== null) {
    if (expMin >= 5) return "senior";
    if (expMin <= 1) return "entry";
  }
  return "mid";
}

export type JobType = "full-time" | "part-time" | "contract" | "internship";

export function inferJobType(title: string, atsType?: string | null): JobType {
  const t = `${title} ${atsType ?? ""}`.toLowerCase();
  if (/\bintern(ship)?\b|\btrainee\b/.test(t)) return "internship";
  if (/\b(contract|contractor|freelance|temporary|temp)\b/.test(t)) return "contract";
  if (/\bpart[\s-]?time\b/.test(t)) return "part-time";
  return "full-time";
}

const CATEGORY_RULES: [string, RegExp][] = [
  ["engineering", /\b(engineer|developer|swe|sde|programmer|devops|sre|architect|full[\s-]?stack|front[\s-]?end|back[\s-]?end|software|qa|test|security|infrastructure|platform|embedded|firmware|mobile|ios|android)\b/i],
  ["data", /\b(data|analytics|analyst|machine learning|ml |ai |scientist|research)\b/i],
  ["design", /\b(design|ux|ui|creative|graphic|illustrator|brand)\b/i],
  ["product", /\b(product manager|product owner|program manager|pm\b|product)\b/i],
  ["marketing", /\b(marketing|seo|content|growth|social media|brand|communications|copywriter)\b/i],
  ["sales", /\b(sales|account executive|business development|bdr|sdr|partnerships|revenue)\b/i],
  ["hr", /\b(hr\b|human resources|recruit|talent|people ops|people operations)\b/i],
  ["finance", /\b(finance|accounting|accountant|controller|treasury|payroll|audit)\b/i],
  ["operations", /\b(operations|ops\b|supply chain|logistics|procurement|office manager|administrative|legal|counsel)\b/i],
  ["support", /\b(support|customer success|customer service|help desk|technical account)\b/i],
];

export function inferCategory(title: string): string {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(title)) return cat;
  }
  return "other";
}

// Major Indian metro/tech-hub names — location strings from ATSes are free text with no
// structured country field, so this is a heuristic keyword match, not a geocoder. Extend this
// list if a legitimate India-based posting is getting filtered out incorrectly.
const INDIA_LOCATION_PATTERN = new RegExp(
  "\\b(" + [
    "india", "bengaluru", "bangalore", "mumbai", "new delhi", "delhi", "ncr",
    "hyderabad", "pune", "chennai", "kolkata", "calcutta", "gurgaon", "gurugram",
    "noida", "ahmedabad", "jaipur", "kochi", "cochin", "chandigarh", "indore",
    "coimbatore", "trivandrum", "thiruvananthapuram", "vadodara", "nagpur",
    "surat", "visakhapatnam", "bhubaneswar", "mysuru", "mysore",
  ].join("|") + ")\\b",
  "i"
);

/** Best-effort check for whether a job listing is India-based, from free-text location/title. */
export function isIndiaLocation(location: string, title = ""): boolean {
  return INDIA_LOCATION_PATTERN.test(location) || INDIA_LOCATION_PATTERN.test(title);
}

export function htmlToText(html: string): string {
  return html
    // some ATSes (Greenhouse) return entity-escaped HTML — unescape tags first
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
