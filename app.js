// ── Config ──────────────────────────────────────────────────────────────────
const API_URL  = 'https://radarlens-proxy.oscarsa85.workers.dev';
const MODEL    = 'anthropic/claude-haiku-4-5';
let DEV_MODE = false;

// ── State ────────────────────────────────────────────────────────────────────
let risks = [];
let issues = []; // kept for legacy functions — not used in new flow
let dependencies = [];
let stakeholders = [];
let scenarios = null;
let loadingInterval = null;
let budgetCount  = 3;
let budgetEffort = 'low';
let optimizerMode = 'quick'; // 'quick' | 'balanced' | 'full'
let currentModule = 'cockpit';
let projectScope = ''; let projectStart = ''; let projectEnd = ''; let projectBudget = ''; let projectIndustry = ''; let projectCurrency = '$';
let pinnedDepIds = [];
let pinnedIssueIds = []; // legacy — not used in new flow
let issuesDepLoaded = false; // legacy
let issuesDepLoading = false; // legacy

// ── Header tagline rotation ───────────────────────────────────────────────────
const TAGLINES = [
  'Identify risks before they identify you.',
  'Built by a PM. For PMs.',
  'Stop guessing. Start assessing.',
  'Turn uncertainty into a plan.',
  'Know your risks. Own your project.',
  'Your project, stress-tested in seconds.',
  'Because optimism is not a project management strategy.',
  'See your project\'s future before it sees you.',
  'Risk-aware PMs deliver. Optimistic ones apologize.',
  'Stop flying blind. Check your instruments.',
  'Precision over intuition. Every single time.',
  'What ChatGPT won\'t tell you about your project.',
];

function startTaglineRotation() {
  const el = document.getElementById('header-tagline');
  if (!el) return;
  const i = Math.floor(Math.random() * TAGLINES.length);
  el.textContent = TAGLINES[i];
}

// ── Loading messages ──────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  'Identifying blocked dependencies before they block you...',
  'Mapping the stakeholders who can derail your project...',
  'Finding the risks you forgot to write down...',
  'Calculating how optimistic your timeline really is...',
  'Identifying who needs managing before they need escalating...',
  'Scanning for scope creep before it scans for you...',
  'Stress-testing your budget assumptions...',
  'Spotting the unknown unknowns you didn\'t know you had...',
  'Checking if your contingency reserve is actually enough...',
  'Surfacing the dependencies nobody documented...',
  'Mapping which mitigations give you the most bang for your effort...',
  'Detecting optimism bias in your schedule...',
  'Finding out what keeps your sponsor up at night...',
  'Calculating how far your worst case really is...',
  'Building the risk register your PM methodology always wanted...',
];

function startLoadingMessages() {
  const el = document.getElementById('loading-message');
  let i = 0;
  el.textContent = LOADING_MESSAGES[0];
  loadingInterval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = LOADING_MESSAGES[i];
      el.style.opacity = '1';
    }, 300);
  }, 3500);
}

function stopLoadingMessages() {
  clearInterval(loadingInterval);
  loadingInterval = null;
}

// ── XSS escape ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const formSection     = document.getElementById('form-section');
const valueStrip      = document.getElementById('value-strip');
const loadingSection  = document.getElementById('loading-section');
const resultsSection  = document.getElementById('results-section');
const generateBtn     = document.getElementById('generate-btn');
const newAssessmentBtn = document.getElementById('new-assessment-btn');

// ── Error banner ──────────────────────────────────────────────────────────────
let _errorRetryFn = null;

function showError(title, message, retryFn) {
  const banner  = document.getElementById('error-banner');
  const titleEl = document.getElementById('error-banner-title');
  const msgEl   = document.getElementById('error-banner-msg');
  if (!banner) return;
  titleEl.textContent = title;
  msgEl.textContent   = message;
  banner.classList.remove('hidden');
  _errorRetryFn = retryFn || null;
  document.getElementById('error-banner-retry').classList.toggle('hidden', !retryFn);
}

function hideError() {
  document.getElementById('error-banner')?.classList.add('hidden');
}

document.getElementById('error-banner-close')?.addEventListener('click', hideError);
document.getElementById('error-banner-retry')?.addEventListener('click', () => {
  hideError();
  if (_errorRetryFn) _errorRetryFn();
});

// ── Prompt unificado ─────────────────────────────────────────────────────────
function buildPrompt(scope, startDate, endDate, budget, industry, riskCount = 9) {
  const industryLine = industry ? `Industry: ${industry}` : '';
  const duration = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30));

  return `You are an expert project analyst with 15+ years of experience managing complex projects.

Analyze the following project and generate a complete project assessment in a single JSON response.

PROJECT DETAILS:
Scope: ${scope}
Start Date: ${startDate}
End Date: ${endDate} (approximately ${duration} months)
Budget: ${projectCurrency}${Number(budget).toLocaleString()}
${industryLine}

Respond ONLY with valid JSON matching this exact structure. No markdown, no explanation.

{
  "risks": [
    {
      "id": 1,
      "title": "Short risk title",
      "description": "2-3 sentences specific to this project.",
      "category": "Technical|Resources|External|Regulatory|Financial",
      "probability": "low|medium|high",
      "impact": { "overall": "low|medium|high", "scope": "low|medium|high", "schedule": "low|medium|high", "cost": "low|medium|high" },
      "mitigations": [
        { "title": "string", "description": "string", "effort": "low|medium|high", "effectiveness": "low|medium|high", "affected_dimension": "scope|schedule|cost|all", "score_delta": -2 }
      ]
    }
  ],
  "dependencies": [
    {
      "id": 1,
      "title": "string (max 10 words)",
      "description": "1-2 sentences specific to this project.",
      "type": "internal|external|technical|vendor",
      "from": "string",
      "to": "string",
      "criticality": "low|medium|high|critical",
      "status": "on-track|at-risk|blocked",
      "mitigation": { "title": "string", "effort": "low|medium|high", "score_delta": -1 }
    }
  ],
  "stakeholders": [
    {
      "id": 1,
      "name": "Role or person name",
      "role": "Title or function",
      "power": "low|high",
      "interest": "low|high",
      "quadrant": "manage-closely|keep-satisfied|keep-informed|monitor",
      "attitude": "supportive|neutral|resistant",
      "actions": ["Action 1 specific to this stakeholder", "Action 2", "Action 3"]
    }
  ],
  "scenarios": {
    "best": {
      "probability": 25,
      "timeline_delta_weeks": -2,
      "cost_delta_pct": -5,
      "narrative": "2 sentences describing the best case and what needs to go right.",
      "triggers": ["Condition 1 that enables this outcome", "Condition 2", "Condition 3"],
      "key_mitigation_ids": [1, 2]
    },
    "realistic": {
      "probability": 55,
      "timeline_delta_weeks": 4,
      "cost_delta_pct": 12,
      "narrative": "2 sentences describing the most likely outcome.",
      "triggers": ["Most likely condition 1", "Condition 2", "Condition 3"],
      "key_mitigation_ids": [1]
    },
    "worst": {
      "probability": 20,
      "timeline_delta_weeks": 14,
      "cost_delta_pct": 35,
      "narrative": "2 sentences describing the worst case if critical risks materialize.",
      "triggers": ["What triggers the worst case 1", "Trigger 2", "Trigger 3"],
      "key_mitigation_ids": []
    }
  }
}

Rules:
- risks: exactly ${riskCount}. Mitigations: exactly 2 per risk. score_delta: -1 to -4. Distribute across probability/impact levels.
- dependencies: 4-6, specific to this project. score_delta: -1 to -3.
- stakeholders: 5-8, specific to this project. quadrant must match power/interest combination.
- scenarios: probability of best+realistic+worst must sum to 100. timeline_delta_weeks and cost_delta_pct must be numbers (negative = ahead/under, positive = delay/over).
- key_mitigation_ids: array of risk IDs whose mitigations are most critical for this scenario.
- Everything must be specific to THIS project, not generic.`;
}

// ── Score helpers ─────────────────────────────────────────────────────────────
const LEVEL = { low: 1, medium: 2, high: 3 };
const SCORE_LABEL = { 1: 'low', 2: 'low', 3: 'medium', 4: 'medium', 6: 'high', 9: 'critical' };

function riskScore(r) {
  return LEVEL[r.probability] * LEVEL[r.impact.overall];
}

function scoreLabel(score) {
  if (score <= 2) return 'low';
  if (score <= 4) return 'medium';
  if (score <= 6) return 'high';
  return 'critical';
}

// activeMitigations: { [riskId]: mitIdx } — one active mitigation per risk max
const activeMitigations = {};
// current optimizer plan — used for progress tracking
let currentPlan = [];

// Risk weight: non-linear — critical items penalize disproportionately
function riskWeight(score) {
  if (score >= 9) return 4.0;   // critical: high×high
  if (score >= 6) return 2.5;   // high
  if (score >= 4) return 1.5;   // medium
  return 0.8;                   // low
}

function weightedRiskSum(risks, deltaFn) {
  return risks.reduce((sum, r) => {
    const base  = riskScore(r);
    const delta = deltaFn ? deltaFn(r) : 0;
    const mitigated = Math.max(1, base + delta);
    return sum + mitigated * riskWeight(mitigated);
  }, 0);
}

function maxWeightedRiskSum(risks) {
  // worst case: every risk at score 9
  return risks.reduce((sum, r) => sum + 9 * riskWeight(9), 0);
}

function healthScore(risks) {
  if (!risks.length) return 100;
  const actual = weightedRiskSum(risks, null);
  const max    = maxWeightedRiskSum(risks);
  return Math.round(100 - (actual / max) * 100);
}

function mitigatedHealth(risks) {
  if (!risks.length) return 100;
  const actual = weightedRiskSum(risks, r => {
    if (!r.mitigations.length) return 0;
    return Math.min(...r.mitigations.map(m => m.score_delta));
  });
  const max = maxWeightedRiskSum(risks);
  return Math.round(100 - (actual / max) * 100);
}

function currentHealth(risks) {
  if (!risks.length) return 100;
  const actual = weightedRiskSum(risks, r => {
    const mitIdx = activeMitigations[r.id];
    return mitIdx !== undefined ? r.mitigations[mitIdx].score_delta : 0;
  });
  const max = maxWeightedRiskSum(risks);
  return Math.round(100 - (actual / max) * 100);
}

function updateHealthScore() {
  const visible  = getVisibleRisks();
  const base     = healthScore(visible);
  const current  = currentHealth(visible);
  const el       = document.getElementById('health-score');
  const baseEl   = document.getElementById('health-baseline');
  const clearBtn = document.getElementById('clear-mitigations-btn');
  const mitCount = document.getElementById('mitigation-count');
  const activeCount = Object.keys(activeMitigations).length;

  el.textContent = current;
  if (current >= 70)      el.style.color = 'var(--low)';
  else if (current >= 45) el.style.color = 'var(--medium)';
  else                    el.style.color = 'var(--high)';

  // show baseline (original score) when mitigations are active
  if (current !== base) {
    baseEl.textContent = base;
    baseEl.classList.remove('hidden');
  } else {
    baseEl.classList.add('hidden');
  }

  // mitigation counter + clear button
  mitCount.textContent = activeCount;
  clearBtn.classList.toggle('hidden', activeCount === 0);

  // pulse
  el.classList.remove('score-pulse');
  void el.offsetWidth;
  el.classList.add('score-pulse');

  // also update filter-aware sub-labels
  updateSummaryForFilter();

  // update cockpit in real time
  renderCockpitScores();

  // update scenario simulator if visible
  renderScenariosSimulator();
}

// ── Mock data — Rack Remediation project ─────────────────────────────────────
const MOCK_DATA = {"risks":[{"id":1,"title":"Vendor availability across 72 affiliates","description":"Coordinating local vendors across 72 geographically dispersed affiliates within a 12-month window may result in scheduling conflicts and capacity constraints. Many regions may lack qualified vendors with experience in DFS-compliant infrastructure remediation, leading to delays in critical affiliate locations.","category":"External","probability":"high","impact":{"overall":"high","scope":"medium","schedule":"high","cost":"high"},"mitigations":[{"title":"Pre-qualify vendors in Q4 2025","description":"Establish vendor relationships and capacity commitments 2-3 months before project start. Create tiered vendor network by region with backup options.","effort":"medium","effectiveness":"high","affected_dimension":"schedule","score_delta":-3},{"title":"Implement rolling scheduling approach","description":"Stagger affiliate remediation into waves based on vendor availability and criticality, preventing bottlenecks in high-demand periods.","effort":"medium","effectiveness":"medium","affected_dimension":"schedule","score_delta":-2}]},{"id":2,"title":"Incomplete LAN Harmonization survey data","description":"The remediation scope depends entirely on survey accuracy across 72 affiliates. Missing, outdated, or misclassified must-done items in the survey could result in scope creep or incomplete remediation, compromising DFS standards achievement.","category":"Technical","probability":"medium","impact":{"overall":"high","scope":"high","schedule":"medium","cost":"medium"},"mitigations":[{"title":"Conduct data validation audit","description":"Perform systematic review of LAN Harmonization survey results before project kickoff, validating must-done classifications against DFS standards with IT stakeholders.","effort":"high","effectiveness":"high","affected_dimension":"scope","score_delta":-4},{"title":"Field verification during remediation","description":"Assign field support teams to verify survey accuracy at first 10 affiliate sites and adjust scope model based on real-world findings.","effort":"medium","effectiveness":"medium","affected_dimension":"scope","score_delta":-2}]},{"id":3,"title":"Budget insufficiency for 72 affiliates","description":"The $250,000 budget allocates approximately $3,472 per affiliate for infrastructure remediation, field support, and vendor contracting. Unforeseen cabling complexities or higher regional labor costs could rapidly exhaust budget reserves.","category":"Financial","probability":"high","impact":{"overall":"high","scope":"high","schedule":"low","cost":"high"},"mitigations":[{"title":"Develop cost baseline by region","description":"Conduct detailed cost modeling for each geographic region based on local vendor quotes and labor rates before final budget allocation.","effort":"medium","effectiveness":"high","affected_dimension":"cost","score_delta":-3},{"title":"Establish contingency reserve protocol","description":"Reserve 15% of budget ($37,500) for overruns and contingency; implement approval process for exceeding affiliate-level budgets.","effort":"low","effectiveness":"medium","affected_dimension":"cost","score_delta":-2}]},{"id":4,"title":"Field support resource constraints","description":"Provision of field support where necessary across 72 affiliates in a 12-month period may overwhelm internal resources if multiple sites require simultaneous support. Lack of clarity on support staffing model creates execution risk.","category":"Resources","probability":"medium","impact":{"overall":"medium","scope":"low","schedule":"high","cost":"medium"},"mitigations":[{"title":"Define field support model upfront","description":"Establish criteria for when field support is required versus vendor-only execution. Calculate resource needs and secure staffing commitments before project start.","effort":"low","effectiveness":"high","affected_dimension":"schedule","score_delta":-3},{"title":"Develop remote support capabilities","description":"Create detailed remediation playbooks and video documentation to enable remote guidance, reducing on-site support requirements for straightforward tasks.","effort":"medium","effectiveness":"medium","affected_dimension":"schedule","score_delta":-2}]},{"id":5,"title":"DFS standards compliance verification gaps","description":"The project scope states achieving DFS standards as an outcome but lacks clear acceptance criteria or verification methodology across 72 affiliates. Post-remediation validation could reveal non-compliance issues late in the project.","category":"Regulatory","probability":"medium","impact":{"overall":"medium","scope":"medium","schedule":"high","cost":"low"},"mitigations":[{"title":"Create DFS compliance checklist","description":"Develop detailed, affiliate-specific DFS compliance verification checklist aligned with LAN Harmonization survey must-done items before remediation begins.","effort":"medium","effectiveness":"high","affected_dimension":"all","score_delta":-3},{"title":"Schedule phased compliance audits","description":"Implement post-remediation audit cycles for each wave of affiliates, allowing corrective actions within project timeline rather than at end.","effort":"low","effectiveness":"medium","affected_dimension":"schedule","score_delta":-2}]},{"id":6,"title":"Cabling complexity underestimation","description":"Scope includes remediation of any specific cabling in/to racks detected by survey but actual cabling complexity may vary significantly by affiliate age, construction, and prior interventions. This could lead to extended timelines and cost overruns.","category":"Technical","probability":"medium","impact":{"overall":"medium","scope":"medium","schedule":"medium","cost":"high"},"mitigations":[{"title":"Conduct rack-level pre-site surveys","description":"Schedule 1-2 day pre-remediation site surveys at high-risk affiliates to document cabling conditions, complexity factors, and material requirements accurately.","effort":"medium","effectiveness":"high","affected_dimension":"cost","score_delta":-3},{"title":"Establish tiered cabling remediation approach","description":"Define standard, complex, and high-complexity cabling remediation packages with pre-determined costs and timelines based on survey findings.","effort":"medium","effectiveness":"medium","affected_dimension":"all","score_delta":-2}]},{"id":7,"title":"Affiliate coordination and change management","description":"Engaging 72 affiliate locations requires consistent communication, local approval processes, and coordination with affiliate IT teams who may have competing priorities. Poor coordination could lead to rework and delayed site availability.","category":"Resources","probability":"high","impact":{"overall":"medium","scope":"low","schedule":"high","cost":"low"},"mitigations":[{"title":"Establish affiliate steering committee","description":"Create regional or functional affiliate steering groups to align expectations, communicate remediation schedules, and escalate local blockers monthly.","effort":"low","effectiveness":"high","affected_dimension":"schedule","score_delta":-3},{"title":"Deploy affiliate communication templates","description":"Develop standardized communication packages for consistent, repeated deployment across all 72 affiliates.","effort":"low","effectiveness":"medium","affected_dimension":"schedule","score_delta":-1}]},{"id":8,"title":"12-month timeline compression risk","description":"The fixed 12-month window allows no schedule buffer and limits ability to absorb vendor delays, weather impacts, or site access issues across geographically diverse locations. Peak remediation periods may encounter seasonal constraints.","category":"External","probability":"medium","impact":{"overall":"medium","scope":"low","schedule":"high","cost":"medium"},"mitigations":[{"title":"Develop accelerated schedule with buffer","description":"Plan core remediation work for Q1-Q3 2026, reserving Q4 for contingency work, compliance audits, and remediation of delayed affiliates.","effort":"low","effectiveness":"high","affected_dimension":"schedule","score_delta":-3},{"title":"Implement parallel execution tracks","description":"Organize affiliate remediation into concurrent regional tracks with dedicated vendor teams, enabling multiple site remediation simultaneously.","effort":"medium","effectiveness":"medium","affected_dimension":"schedule","score_delta":-2}]},{"id":9,"title":"Reporting and monitoring data quality","description":"Project requires regular reporting and monitoring of remediation progress across 72 affiliates but lacks defined metrics, reporting frequency, or data collection mechanism. Manual tracking could be error-prone and resource-intensive.","category":"Technical","probability":"low","impact":{"overall":"low","scope":"low","schedule":"medium","cost":"low"},"mitigations":[{"title":"Deploy project tracking dashboard","description":"Implement lightweight project management tool with affiliate-level tracking of survey completion, remediation status, vendor assignment, and compliance verification status.","effort":"medium","effectiveness":"high","affected_dimension":"all","score_delta":-2},{"title":"Define KPIs and reporting cadence","description":"Establish 5-7 key metrics with weekly team reviews and monthly stakeholder reports.","effort":"low","effectiveness":"medium","affected_dimension":"schedule","score_delta":-1}]}],"dependencies":[{"id":1,"title":"LAN Harmonization survey completion","description":"Remediation scope definition depends entirely on completion and sign-off of LAN Harmonization survey identifying must-done actions. Survey validation must occur before vendor selection and affiliate scheduling.","type":"external","from":"LAN Harmonization Project","to":"Remediation Project Start","criticality":"critical","status":"on-track","mitigation":{"title":"Establish survey handoff protocol","effort":"low","score_delta":-2}},{"id":2,"title":"DFS standards documentation availability","description":"Project must validate that DFS standards specifications are clearly documented and accessible to all parties. Compliance verification cannot proceed without authoritative DFS standards reference.","type":"external","from":"DFS Standards Definition","to":"Compliance Verification Process","criticality":"high","status":"on-track","mitigation":{"title":"Secure DFS standards documentation","effort":"low","score_delta":-1}},{"id":3,"title":"Local affiliate IT team engagement","description":"Each of 72 affiliate locations must designate local IT contacts and provide site access for remediation work. Without this engagement, vendor field activities and remediation execution will be blocked.","type":"internal","from":"Affiliate Organization Units","to":"Field Remediation Execution","criticality":"critical","status":"at-risk","mitigation":{"title":"Early affiliate communication campaign","effort":"medium","score_delta":-2}},{"id":4,"title":"Budget allocation and approval","description":"Project execution is dependent on final budget approval and allocation methodology across 72 affiliates. Budget disputes or delayed approval will delay vendor contracting and project initiation.","type":"internal","from":"Finance and Executive Approval","to":"Vendor Contracting Phase","criticality":"high","status":"on-track","mitigation":{"title":"Submit budget approval request Q4 2025","effort":"low","score_delta":-1}},{"id":5,"title":"Field support team staffing decisions","description":"Project execution model depends on defining field support roles, reporting lines, and staffing levels before project start. Resource commitment decisions cascade to schedule feasibility and cost modeling.","type":"internal","from":"HR and Resource Planning","to":"Field Support Execution","criticality":"high","status":"at-risk","mitigation":{"title":"Complete resource plan by November 2025","effort":"medium","score_delta":-2}},{"id":6,"title":"Vendor market capacity and pricing","description":"Project cost and schedule assumptions depend on availability of qualified local vendors in each affiliate region. Regional vendor scarcity or capacity constraints will force schedule adjustments or budget reallocation.","type":"external","from":"Regional Vendor Markets","to":"Remediation Execution","criticality":"high","status":"at-risk","mitigation":{"title":"Execute vendor market assessment Q4 2025","effort":"medium","score_delta":-3}}],"stakeholders":[{"id":1,"name":"Project Sponsor / Executive Steering","role":"Overall project governance and budget authority","power":"high","interest":"high","quadrant":"manage-closely","attitude":"supportive","actions":["Secure executive approval of final scope and $250,000 budget by Q4 2025","Establish escalation path for affiliate-level blockers requiring executive intervention","Review monthly progress reports and DFS compliance achievement metrics"]},{"id":2,"name":"LAN Harmonization Project Lead","role":"Survey data handoff and standards alignment","power":"high","interest":"high","quadrant":"manage-closely","attitude":"supportive","actions":["Finalize and validate LAN Harmonization survey must-done list by December 2025","Provide detailed survey documentation and clarification on DFS compliance requirements","Participate in kickoff meeting and establish ongoing alignment touchpoints"]},{"id":3,"name":"Affiliate IT Directors / Regional Leads","role":"Local site coordination and vendor management oversight","power":"high","interest":"high","quadrant":"manage-closely","attitude":"neutral","actions":["Designate local IT contacts and coordinate site access schedules for remediation activities","Validate local vendor selection and oversee vendor performance during remediation","Report local blockers and compliance status to central project team weekly"]},{"id":4,"name":"Finance and Budget Controller","role":"Budget approval, allocation, and variance management","power":"high","interest":"low","quadrant":"keep-satisfied","attitude":"neutral","actions":["Approve $250,000 budget and authorize regional allocation methodology","Monitor monthly cost tracking and approve contingency spending above affiliate thresholds","Provide quarterly financial status reports to executive steering committee"]},{"id":5,"name":"IT Infrastructure Standards Owner","role":"DFS standards definition and compliance verification","power":"high","interest":"high","quadrant":"manage-closely","attitude":"supportive","actions":["Provide authoritative DFS standards documentation and acceptance criteria to project team","Define compliance verification checklist and audit protocols before remediation begins","Conduct post-remediation compliance audits and sign-off on DFS achievement"]},{"id":6,"name":"Field Support Team Lead","role":"On-site remediation support and vendor coordination","power":"high","interest":"high","quadrant":"manage-closely","attitude":"supportive","actions":["Develop field support model and operational procedures by January 2026","Coordinate field team scheduling and affiliate site access logistics","Document on-site findings and remediation progress for central tracking dashboard"]},{"id":7,"name":"Vendor Management / Procurement Lead","role":"Local vendor sourcing and contracting","power":"high","interest":"low","quadrant":"keep-satisfied","attitude":"neutral","actions":["Execute vendor market assessment and identify qualified regional vendors by Q4 2025","Develop vendor RFQ, contracting templates, and performance SLA frameworks","Monitor vendor performance and manage vendor escalations throughout project execution"]},{"id":8,"name":"Project Manager","role":"Day-to-day project execution, reporting, and issue tracking","power":"high","interest":"high","quadrant":"manage-closely","attitude":"supportive","actions":["Develop detailed project plan with affiliate-level scheduling and resource allocation","Establish and maintain project tracking dashboard with weekly KPI updates","Facilitate weekly team standups and monthly stakeholder steering committee meetings"]}],"scenarios":{"best":{"probability":25,"timeline_delta_weeks":-2,"cost_delta_pct":-5,"narrative":"Pre-qualified vendor network is established on schedule with adequate regional capacity, LAN Harmonization survey is validated early without scope adjustments, and affiliate IT teams coordinate efficiently with minimal site access delays. All remediation activities execute within planned timelines and budget allocations, with no material cabling complexity discoveries or compliance verification issues.","triggers":["LAN Harmonization survey completion 2 weeks early with high data quality","Vendor market assessment identifies 3+ qualified vendors per region with available capacity","Affiliate IT teams proactively engage and provide committed remediation windows in advance"],"key_mitigation_ids":[1,2]},"realistic":{"probability":55,"timeline_delta_weeks":4,"cost_delta_pct":12,"narrative":"Vendor availability is moderately constrained in 2-3 regions, requiring schedule adjustments and some affiliate sites slip from Q1/Q2 into Q3. LAN Harmonization survey requires minor scope clarifications, and 1-2 affiliate sites reveal cabling complexity beyond survey documentation, leading to modest overruns. Overall project completes by Q4 2026 with budget utilization near contingency reserve.","triggers":["Vendor capacity tightness in EMEA or APAC regions delays Q2 affiliate start dates by 3-4 weeks","LAN Harmonization survey identifies 5-10% additional must-do items during field validation","Cabling discoveries at 3-5 affiliate sites exceed pre-site survey estimates by 20-30%"],"key_mitigation_ids":[1,3,6]},"worst":{"probability":20,"timeline_delta_weeks":14,"cost_delta_pct":35,"narrative":"Significant vendor capacity constraints across multiple regions force sequential rather than parallel execution, causing cascading schedule delays through Q3 and into Q4. Substantial scope discrepancies between LAN Harmonization survey and field reality emerge early, requiring rework and additional affiliate visits. Multiple compliance verification failures require remediation iterations, consuming both budget reserves and schedule contingency.","triggers":["2+ regions experience vendor unavailability or capacity sellouts, forcing affiliate rescheduling into Q3/Q4","LAN Harmonization survey validation reveals 20%+ scope variance requiring major rework and re-estimation","Field teams discover pervasive cabling infrastructure issues affecting 30%+ of affiliates, exceeding budget per-site allocations by 40%+"],"key_mitigation_ids":[]}}};

// ── API call — unified assessment ────────────────────────────────────────────
async function generateAssessment(scope, startDate, endDate, budget, industry) {
  if (DEV_MODE) {
    await new Promise(r => setTimeout(r, 1800));
    return JSON.parse(JSON.stringify(MOCK_DATA));
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 7000,
      messages: [{
        role: 'user',
        content: buildPrompt(scope, startDate, endDate, budget, industry, currentTier === 'pro' ? 20 : 9)
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}


function impactClass(val) {
  if (!val) return 'neutral';
  const v = val.toLowerCase();
  const positiveWords = ['-', 'ahead', 'under', 'full scope', 'on track', 'no change'];
  const negativeWords = ['cut', 'cancel', 'reset', 'delay', 'over budget', 'significant', 'major', 'reduced'];
  if (positiveWords.some(w => v.includes(w)) && !v.startsWith('+')) return 'positive';
  if (v.startsWith('+') || negativeWords.some(w => v.includes(w))) return 'negative';
  return 'neutral';
}

function renderScenarios(scenarios) {
  const grid = document.getElementById('scenarios-grid');
  grid.innerHTML = '';

  const defs = [
    { key: 'best',      label: 'Best Case',    icon: '↑' },
    { key: 'realistic', label: 'Realistic',    icon: '→' },
    { key: 'worst',     label: 'Worst Case',   icon: '↓' },
  ];

  defs.forEach(({ key, label, icon }) => {
    const s = scenarios[key];
    if (!s) return;

    const card = document.createElement('div');
    card.className = `scenario-card ${key}`;
    card.innerHTML = `
      <div class="scenario-header">
        <span class="scenario-name">${icon} ${label}</span>
        <span class="scenario-health">${s.health_score}</span>
      </div>
      <p class="scenario-summary">${esc(s.summary)}</p>
      <div class="scenario-impacts">
        <div class="scenario-impact-row">
          <span class="impact-dim">Schedule</span>
          <span class="impact-val">${esc(s.schedule_impact)}</span>
        </div>
        <div class="scenario-impact-row">
          <span class="impact-dim">Cost</span>
          <span class="impact-val">${esc(s.cost_impact)}</span>
        </div>
        <div class="scenario-impact-row">
          <span class="impact-dim">Scope</span>
          <span class="impact-val">${esc(s.scope_impact)}</span>
        </div>
      </div>
      ${Array.isArray(s.key_conditions) && s.key_conditions.length ? `
      <div class="scenario-risks">
        <strong>Key conditions</strong>
        ${s.key_conditions.map(c => `• ${esc(c)}`).join('<br>')}
      </div>` : ''}
      ${Array.isArray(s.risks_materialized) && s.risks_materialized.length ? `
      <div class="scenario-risks">
        <strong>Risks in play</strong>
        ${s.risks_materialized.map(r => `• ${esc(r)}`).join('<br>')}
      </div>` : ''}`;
    grid.appendChild(card);
  });
}

// ── Render helpers ────────────────────────────────────────────────────────────
function badgeClass(level) {
  return `badge badge-${level}`;
}

function renderHeatmap(risks) {
  document.querySelectorAll('.cell-dots').forEach(el => el.innerHTML = '');

  // add click handler to each cell
  document.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.classList.remove('selected', 'dimmed');
    cell.onclick = () => applyHeatmapFilter(cell.dataset.prob, cell.dataset.imp);
  });

  risks.forEach(r => {
    const prob = r.probability;
    const imp  = r.impact.overall;
    const cell = document.getElementById(`cell-${prob}-${imp}`);
    if (!cell) return;

    const dot = document.createElement('div');
    dot.className = 'risk-dot';
    dot.title = r.title;
    dot.dataset.id = r.id;
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToRisk(r.id);
    });
    cell.appendChild(dot);
  });
}

function renderCoverage(risks) {
  const categories = ['Technical', 'Resources', 'External', 'Regulatory', 'Financial'];
  const container = document.getElementById('coverage-bars');
  container.innerHTML = '';

  categories.forEach(cat => {
    const count = risks.filter(r => r.category === cat).length;
    const pct   = Math.min(100, Math.round((count / risks.length) * 100 * 2.5));

    const item = document.createElement('div');
    item.className = 'coverage-item';
    item.dataset.category = cat;
    item.title = `Filter by ${cat}`;
    item.innerHTML = `
      <div class="coverage-header">
        <span class="coverage-name">${cat}</span>
        <span class="coverage-pct">${count} risk${count !== 1 ? 's' : ''}</span>
      </div>
      <div class="coverage-track">
        <div class="coverage-fill" style="width: 0%" data-target="${pct}"></div>
      </div>`;

    item.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      applyCategoryFilter(isActive ? null : cat);
    });

    container.appendChild(item);
  });

  requestAnimationFrame(() => {
    document.querySelectorAll('.coverage-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  });
}

function getVisibleRisks() {
  if (!activeCategoryFilter && !activeHeatmapCell) return risks;
  return risks.filter(r => {
    const matchesCat  = !activeCategoryFilter || r.category === activeCategoryFilter;
    const matchesCell = !activeHeatmapCell ||
      (r.probability === activeHeatmapCell.prob && r.impact.overall === activeHeatmapCell.imp);
    return matchesCat && matchesCell;
  });
}

function renderSummary(risks) {
  const hs       = healthScore(risks);
  const critical = risks.filter(r => scoreLabel(riskScore(r)) === 'critical').length;

  const best = mitigatedHealth(risks);

  document.getElementById('health-score').textContent = hs;
  document.getElementById('health-best').textContent  = `Best possible: ${best}`;
  document.getElementById('risk-count').textContent   = risks.length;
  document.getElementById('critical-count').textContent = critical;
  document.getElementById('mitigation-count').textContent = 0;
  document.getElementById('health-baseline').classList.add('hidden');
  document.getElementById('clear-mitigations-btn').classList.add('hidden');
  document.getElementById('risk-count-sub').textContent = '';
  document.getElementById('critical-count-sub').textContent = '';
  updateActiveFiltersBar();

  const hsEl = document.getElementById('health-score');
  if (hs >= 70) hsEl.style.color = 'var(--low)';
  else if (hs >= 45) hsEl.style.color = 'var(--medium)';
  else hsEl.style.color = 'var(--high)';
}

function updateSummaryForFilter() {
  const visible  = getVisibleRisks();
  const total    = risks.length;
  const isFiltered = visible.length < total;
  updateActiveFiltersBar();

  // health score of visible subset
  const hs       = healthScore(visible);
  const current  = currentHealth(visible);
  const critical = visible.filter(r => scoreLabel(riskScore(r)) === 'critical').length;
  const totalCrit = risks.filter(r => scoreLabel(riskScore(r)) === 'critical').length;

  const hsEl = document.getElementById('health-score');
  hsEl.textContent = current;
  if (current >= 70) hsEl.style.color = 'var(--low)';
  else if (current >= 45) hsEl.style.color = 'var(--medium)';
  else hsEl.style.color = 'var(--high)';

  // show baseline if differs from current
  const baseEl = document.getElementById('health-baseline');
  if (current !== hs) {
    baseEl.textContent = hs;
    baseEl.classList.remove('hidden');
  } else {
    baseEl.classList.add('hidden');
  }

  document.getElementById('risk-count').textContent = visible.length;
  document.getElementById('risk-count-sub').textContent = isFiltered ? `of ${total}` : '';
  document.getElementById('critical-count').textContent = critical;
  document.getElementById('critical-count-sub').textContent = isFiltered && totalCrit !== critical ? `of ${totalCrit}` : '';
}

function renderRiskList(risks) {
  const container = document.getElementById('risk-list');
  container.innerHTML = '';
  if (localStorage.getItem('mitigationHintSeen')) container.classList.add('mitigation-hint-seen');

  risks.forEach(r => {
    const score = riskScore(r);
    const label = scoreLabel(score);

    const card = document.createElement('div');
    card.className = 'risk-card';
    card.id = `risk-card-${r.id}`;
    card.dataset.id = r.id;
    card.dataset.severity = label;
    card.dataset.category = r.category;

    card.innerHTML = `
      <div class="risk-card-header risk-card-toggle" data-id="${r.id}">
        <div class="risk-header-left">
          <span class="risk-expand-icon">▶</span>
          <div class="risk-title">${esc(r.title)}</div>
        </div>
        <div class="risk-badges">
          <span class="${badgeClass(label)}">${label}</span>
          <span class="badge badge-${r.probability}">prob: ${r.probability}</span>
          <span class="badge badge-${r.impact.overall}">impact: ${r.impact.overall}</span>
          <input class="owner-input" type="text" placeholder="Owner" value="${esc(r.owner || '')}" data-owner-risk="${r.id}" title="Assign owner" />
          <button class="risk-edit-btn" data-risk-id="${r.id}" title="Edit probability, impact or description">✏️ Edit risk</button>
        </div>
      </div>
      <div class="risk-card-body hidden" id="risk-body-${r.id}">
        <p class="risk-description">${esc(r.description)}</p>
        <div class="risk-impact-row">
          <div class="impact-chip">Scope <span>${r.impact.scope}</span></div>
          <div class="impact-chip">Schedule <span>${r.impact.schedule}</span></div>
          <div class="impact-chip">Cost <span>${r.impact.cost}</span></div>
          <div class="impact-chip">Category <span>${esc(r.category)}</span></div>
        </div>
        <div class="whatif-bar" id="whatif-${r.id}">
          <span class="whatif-label">What-if score:</span>
          <span class="whatif-scores">
            <span class="whatif-none">→ Click a mitigation to simulate its impact</span>
          </span>
        </div>
      <div class="mitigations-list" id="mitigations-${r.id}">
        ${r.mitigations.map((m, mi) => {
          // diminishing returns: each subsequent mitigation yields less than the previous
          const prevDelta = mi > 0 ? r.mitigations[mi - 1].score_delta : null;
          const drPct     = prevDelta ? Math.round((1 - Math.abs(m.score_delta) / Math.abs(prevDelta)) * 100) : 0;
          const drWarning = mi > 0 && drPct > 0
            ? `<div class="dr-warning">⚠ ${drPct}% less improvement than mitigation #${mi}. Consider applying this effort to another risk instead.</div>`
            : '';
          const baseHealth = healthScore(risks);
          const healthWithMit = Math.round(100 - (weightedRiskSum(risks, rx => {
            if (rx.id === r.id) return m.score_delta;
            const idx = activeMitigations[rx.id];
            return idx !== undefined ? rx.mitigations[idx].score_delta : 0;
          }) / maxWeightedRiskSum(risks)) * 100);
          const healthGain = healthWithMit - baseHealth;
          return `
          <div class="mitigation-item" data-risk-id="${r.id}" data-mit-idx="${mi}" title="Click to apply/remove this mitigation">
            <div class="mitigation-header">
              <span class="mitigation-title">${esc(m.title)}</span>
            </div>
            <div class="mitigation-meta">
              <span class="badge badge-low mitigation-health-badge">health +${healthGain}pts</span>
              <span class="badge badge-${m.effort}">effort: ${m.effort}</span>
              <span class="badge badge-${m.effectiveness}">effectiveness: ${m.effectiveness}</span>
              <span class="badge" style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border)">${esc(m.affected_dimension)}</span>
            </div>
            <p class="mitigation-description">${esc(m.description)}</p>
            ${drWarning}
          </div>`;
        }).join('')}
      </div>
      </div>`;  // close risk-card-body

    container.appendChild(card);
  });

  // owner input
  container.querySelectorAll('.owner-input[data-owner-risk]').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      const r = risks.find(x => x.id === parseInt(input.dataset.ownerRisk));
      if (r) r.owner = input.value.trim();
    });
  });

  // edit button
  container.querySelectorAll('.risk-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const riskId = parseInt(btn.dataset.riskId);
      // auto-expand first
      const body = document.getElementById(`risk-body-${riskId}`);
      const icon = btn.closest('.risk-card').querySelector('.risk-expand-icon');
      if (body && body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        if (icon) icon.textContent = '▼';
        btn.closest('.risk-card').classList.add('expanded');
      }
      openEditForm(riskId);
    });
  });

  // expand/collapse risk card body on header click
  container.querySelectorAll('.risk-card-toggle').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.mitigation-item')) return;
      const id   = header.dataset.id;
      const body = document.getElementById(`risk-body-${id}`);
      const icon = header.querySelector('.risk-expand-icon');
      const card = header.closest('.risk-card');
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      if (icon) icon.textContent = open ? '▶' : '▼';
      card.classList.toggle('expanded', !open);

      // show edit hint once, first time any card is expanded
      if (!open && !localStorage.getItem('riskEditHintSeen')) {
        const hint = document.getElementById('risk-edit-hint');
        if (hint) {
          hint.classList.remove('hidden');
          localStorage.setItem('riskEditHintSeen', '1');
        }
      }
    });
  });

  // what-if: click mitigation to apply/remove + update global health score
  container.querySelectorAll('.mitigation-item').forEach(item => {
    item.addEventListener('click', () => {
      const riskId    = parseInt(item.dataset.riskId);
      const mitIdx    = parseInt(item.dataset.mitIdx);
      const r         = risks.find(x => x.id === riskId);
      const baseScore = riskScore(r);
      const wasActive = item.classList.contains('active');

      // deactivate all mitigations for this risk
      container.querySelectorAll(`.mitigation-item[data-risk-id="${riskId}"]`).forEach(el => el.classList.remove('active'));

      if (!wasActive) {
        item.classList.add('active');
        activeMitigations[riskId] = mitIdx;
        const delta    = r.mitigations[mitIdx].score_delta;
        const newScore = Math.max(1, baseScore + delta);
        document.getElementById(`whatif-${riskId}`).querySelector('.whatif-scores').innerHTML = `
          <span class="whatif-before">${baseScore}/9 ${scoreLabel(baseScore)}</span>
          <span class="whatif-arrow">→</span>
          <span class="whatif-after">${newScore}/9 ${scoreLabel(newScore)}</span>`;
        // hide "click to apply" hints globally after first interaction
        if (!localStorage.getItem('mitigationHintSeen')) {
          localStorage.setItem('mitigationHintSeen', '1');
          container.classList.add('mitigation-hint-seen');
        }
      } else {
        delete activeMitigations[riskId];
        document.getElementById(`whatif-${riskId}`).querySelector('.whatif-scores').innerHTML =
          `<span class="whatif-none">→ Click a mitigation to simulate its impact</span>`;
      }

      updateHealthScore();
      updatePlanProgress();
    });
  });
}

// ── Edit risk inline ──────────────────────────────────────────────────────────
function openEditForm(riskId) {
  const r    = risks.find(x => x.id === riskId);
  const body = document.getElementById(`risk-body-${riskId}`);
  if (!r || !body) return;

  // remove existing edit form if any
  const existing = body.querySelector('.risk-edit-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'risk-edit-form';
  form.innerHTML = `
    <div class="form-group">
      <label class="budget-label">Title</label>
      <input type="text" class="edit-title" value="${r.title}" />
    </div>
    <div class="form-group">
      <label class="budget-label">Description</label>
      <textarea class="edit-desc" rows="2">${r.description}</textarea>
    </div>
    <div class="risk-edit-row">
      <div class="form-group">
        <label class="budget-label">Probability</label>
        <select class="edit-prob">
          ${['low','medium','high'].map(v => `<option value="${v}" ${r.probability===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="budget-label">Impact</label>
        <select class="edit-impact">
          ${['low','medium','high'].map(v => `<option value="${v}" ${r.impact.overall===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="budget-label">Category</label>
        <select class="edit-cat">
          ${['Technical','Resources','External','Regulatory','Financial'].map(v => `<option value="${v}" ${r.category===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="risk-edit-actions">
      <button class="btn-primary edit-save" style="max-width:120px">Save</button>
      <button class="btn-secondary edit-cancel">Cancel</button>
    </div>`;

  body.appendChild(form);

  form.querySelector('.edit-cancel').addEventListener('click', () => form.remove());
  form.querySelector('.edit-save').addEventListener('click', () => {
    r.title       = form.querySelector('.edit-title').value.trim() || r.title;
    r.description = form.querySelector('.edit-desc').value.trim() || r.description;
    r.probability = form.querySelector('.edit-prob').value;
    const newImp  = form.querySelector('.edit-impact').value;
    r.impact.overall = r.impact.scope = r.impact.schedule = r.impact.cost = newImp;
    r.category    = form.querySelector('.edit-cat').value;

    // re-render everything affected
    renderRiskList(risks);
    renderHeatmap(risks);
    renderSummary(risks);
    renderCoverage(risks);
    renderCountGuidance();
    updateActiveFiltersBar();
  });
}

// ── Add custom risk (Pro) ─────────────────────────────────────────────────────
function setupAddRisk() {
  const saveBtn   = document.getElementById('save-risk-btn');
  const cancelBtn = document.getElementById('cancel-risk-btn');
  if (!saveBtn) return;

  cancelBtn.addEventListener('click', () => {
    document.getElementById('new-risk-title').value = '';
    document.getElementById('new-risk-desc').value  = '';
  });

  saveBtn.addEventListener('click', () => {
    const title = document.getElementById('new-risk-title').value.trim();
    if (!title) { alert('Title is required.'); return; }

    const prob   = document.getElementById('new-risk-probability').value;
    const imp    = document.getElementById('new-risk-impact').value;
    const cat    = document.getElementById('new-risk-category').value;
    const desc   = document.getElementById('new-risk-desc').value.trim();
    const newId  = Math.max(...risks.map(r => r.id), 0) + 1;

    risks.push({
      id: newId, title, description: desc || 'Custom risk added by PM.',
      category: cat, probability: prob,
      impact: { overall: imp, scope: imp, schedule: imp, cost: imp },
      mitigations: []
    });

    renderRiskList(risks);
    renderHeatmap(risks);
    renderSummary(risks);
    renderCoverage(risks);
    renderCountGuidance();

    document.getElementById('new-risk-title').value = '';
    document.getElementById('new-risk-desc').value  = '';
  });
}

// ── Export (Pro — stub) ───────────────────────────────────────────────────────
function setupExport() {
  const pdfBtn   = document.getElementById('export-pdf-btn');
  const excelBtn = document.getElementById('export-excel-btn');
  if (pdfBtn)   pdfBtn.addEventListener('click', () => {
    const projectName = document.getElementById('result-project-name')?.textContent || 'Risk Assessment';
    const original = document.title;
    document.title = `Risk Assessment — ${projectName}`;

    // expand all card bodies before print
    const wasHidden = [];
    document.querySelectorAll('.risk-card-body, .issue-card-body, .dep-card-body').forEach(el => {
      if (el.classList.contains('hidden')) { wasHidden.push(el); el.classList.remove('hidden'); }
    });
    const mitWasHidden = [];
    document.querySelectorAll('[id^="mitigations-"]').forEach(el => {
      if (el.classList.contains('hidden')) { mitWasHidden.push(el); el.classList.remove('hidden'); }
    });

    // let browser repaint before opening print dialog
    setTimeout(() => {
      window.print();

      // restore collapsed state after print dialog closes
      wasHidden.forEach(el => el.classList.add('hidden'));
      mitWasHidden.forEach(el => el.classList.add('hidden'));
      document.title = original;
    }, 150);
  });
  if (excelBtn) excelBtn.addEventListener('click', () => exportExcel());

  const sessionBtn  = document.getElementById('export-session-btn');
  const loadInput   = document.getElementById('load-session-input');
  if (sessionBtn) sessionBtn.addEventListener('click', saveSession);
  if (loadInput)  loadInput.addEventListener('change', e => loadSession(e.target.files[0]));
}

function saveSession() {
  const projectName = document.getElementById('result-project-name')?.textContent || 'assessment';

  const state = {
    version: 3,
    savedAt: new Date().toISOString(),
    project: {
      name: projectName,
      scope: projectScope,
      start: projectStart,
      end: projectEnd,
      budget: projectBudget,
      industry: projectIndustry,
      currency: projectCurrency,
    },
    risks,
    dependencies,
    stakeholders,
    scenarios,
    activeMitigations: Object.fromEntries(
      Object.entries(activeMitigations).map(([k, v]) => [Number(k), v])
    ),
    currentPlan,
    pinnedDepIds,
    optimizer: { mode: optimizerMode },
  };

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${projectName.replace(/\s+/g, '-')}-assessment.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function validateSessionSchema(state) {
  if (!state || typeof state !== 'object') throw new Error('File is not a valid JSON object.');
  if (!Array.isArray(state.risks) || state.risks.length === 0) throw new Error('Missing or empty risks array.');
  if (typeof state.version !== 'number') throw new Error('Missing version field — file may be from an incompatible version.');
  if (state.version > 3) throw new Error(`Session version ${state.version} is newer than this app supports.`);
  const risk = state.risks[0];
  if (!risk.id || !risk.title || !risk.probability || !risk.impact) throw new Error('Risk data is malformed or incomplete.');
  if (state.dependencies !== undefined && !Array.isArray(state.dependencies)) throw new Error('Dependencies field is malformed.');
  if (state.stakeholders !== undefined && !Array.isArray(state.stakeholders)) throw new Error('Stakeholders field is malformed.');
}

function loadSession(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const state = JSON.parse(e.target.result);
      validateSessionSchema(state);

      // restore state with safe fallbacks
      risks        = state.risks        || [];
      dependencies = Array.isArray(state.dependencies) ? state.dependencies : [];
      stakeholders = Array.isArray(state.stakeholders) ? state.stakeholders : [];
      scenarios    = state.scenarios    || null;
      Object.keys(activeMitigations).forEach(k => delete activeMitigations[k]);
      Object.entries(state.activeMitigations || {}).forEach(([k, v]) => {
        activeMitigations[Number(k)] = v;
      });
      currentPlan  = Array.isArray(state.currentPlan)  ? state.currentPlan  : [];
      pinnedDepIds = Array.isArray(state.pinnedDepIds)  ? state.pinnedDepIds : [];

      // restore optimizer mode (optional — may be absent in older saves)
      optimizerMode = state.optimizer?.mode || 'quick';
      document.querySelectorAll('.optimizer-mode-card').forEach(c => {
        c.classList.toggle('active', c.dataset.mode === optimizerMode);
      });

      projectScope    = state.project?.scope    || '';
      projectStart    = state.project?.start    || '';
      projectEnd      = state.project?.end      || '';
      projectBudget   = state.project?.budget   || '';
      projectIndustry = state.project?.industry || '';
      projectCurrency = state.project?.currency || '$';

      // show results
      formSection.classList.add('hidden');
      valueStrip?.classList.add('hidden');
      loadingSection.classList.add('hidden');
      resultsSection.classList.remove('hidden');
      document.getElementById('module-nav').classList.remove('hidden');

      document.getElementById('result-project-name').textContent = state.project?.name || 'Loaded Assessment';
      document.getElementById('result-project-meta').textContent =
        `${projectStart} → ${projectEnd}  ·  ${projectCurrency}${Number(projectBudget).toLocaleString()}${projectIndustry ? '  ·  ' + projectIndustry : ''}`;

      renderSummary(risks);
      renderHeatmap(risks);
      renderCoverage(risks);
      renderRiskList(risks);
      document.getElementById('anchor-optimizer').classList.remove('hidden');
      document.getElementById('budget-result').classList.add('hidden');
      document.getElementById('add-risk-section').classList.remove('hidden');

      renderDependenciesList();
      renderDepsCoverage();
      renderDepsSummaryBar();
      document.getElementById('add-dep-section')?.classList.remove('hidden');
      setupAddDep();

      renderStakeholders();
      document.getElementById('add-stakeholder-section')?.classList.remove('hidden');
      setupAddStakeholder();

      if (scenarios) renderScenarios(scenarios);

      applyTier(currentTier);
      renderOptimizerGuidance(parseFloat(projectBudget) || 0);
      renderCountGuidance();
      setupAddRisk();
      setupExport();

      switchTab('cockpit');
      renderCockpitScores();
      renderPulseBar();

      document.getElementById('load-session-input').value = '';
    } catch (err) {
      showError('Could not load session', err.message || 'The file may be corrupted or from an incompatible version.');
    }
  };
  reader.readAsText(file);
}

function exportExcel() {
  const projectName  = document.getElementById('result-project-name').textContent;
  const meta         = document.getElementById('result-project-meta').textContent;
  const riskHS       = currentHealth(risks);
  const riskBaseline = healthScore(risks);
  const riskBest     = mitigatedHealth(risks);
  const depHS        = dependencies.length ? depsHealth()       : null;
  const shHS         = stakeholders.length ? stakeholdersHealth(): null;
  const cockpitHS    = cockpitScore();
  const appliedCount = Object.keys(activeMitigations).length;
  const bySeverity   = s => risks.filter(r => scoreLabel(riskScore(r)) === s).length;

  const c   = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sep = () => '';

  const lines = [];

  // ── Section 1: Project Summary ─────────────────────────────────────────────
  lines.push(c('PROJECT SUMMARY'));
  lines.push([c('Project Name'),   c(projectName)].join(','));
  lines.push([c('Details'),        c(meta)].join(','));
  lines.push([c('Export Date'),    c(new Date().toLocaleDateString('en-GB'))].join(','));
  lines.push(sep());

  // ── Section 2: Health Scores ───────────────────────────────────────────────
  lines.push(c('HEALTH SCORES'));
  lines.push([c('Module'), c('Score'), c('Notes')].join(','));
  lines.push([c('Project Readiness (Cockpit)'), c(cockpitHS ?? '—'), c('Weighted: 40% Risks + 30% Dependencies + 20% Stakeholders + 10% Scenarios')].join(','));
  lines.push([c('Risks — Baseline'),  c(riskBaseline), c('No mitigations applied')].join(','));
  lines.push([c('Risks — Current'),   c(riskHS),       c(`${appliedCount} mitigation(s) active`)].join(','));
  lines.push([c('Risks — Best Possible'), c(riskBest), c('All mitigations applied')].join(','));
  if (depHS !== null) lines.push([c('Dependencies Health'), c(depHS), c('Based on status × criticality')].join(','));
  if (shHS  !== null) lines.push([c('Stakeholders Health'), c(shHS),  c('Penalizes resistant and unowned stakeholders')].join(','));
  lines.push(sep());

  // ── Section 3: Risk Breakdown ──────────────────────────────────────────────
  lines.push(c('RISK BREAKDOWN'));
  lines.push([c('Total'), c('Critical'), c('High'), c('Medium'), c('Low'), c('Mitigations Applied')].join(','));
  lines.push([c(risks.length), c(bySeverity('critical')), c(bySeverity('high')), c(bySeverity('medium')), c(bySeverity('low')), c(appliedCount)].join(','));
  lines.push(sep());

  // ── Section 4: Risk Register ───────────────────────────────────────────────
  lines.push(c('RISK REGISTER'));
  lines.push([
    c('ID'), c('Title'), c('Owner'), c('Category'),
    c('Probability'), c('Impact'), c('Scope'), c('Schedule'), c('Cost'),
    c('Risk Score'), c('Severity'), c('Description'),
    c('Active Mitigation'),
    c('MIT 1 — Title'), c('MIT 1 — Effort'), c('MIT 1 — Effectiveness'), c('MIT 1 — Score Delta'), c('MIT 1 — Description'),
    c('MIT 2 — Title'), c('MIT 2 — Effort'), c('MIT 2 — Effectiveness'), c('MIT 2 — Score Delta'), c('MIT 2 — Description'),
  ].join(','));

  risks.forEach(r => {
    const score        = riskScore(r);
    const severity     = scoreLabel(score);
    const activeMitIdx = activeMitigations[r.id];
    const activeMitTitle = activeMitIdx !== undefined ? (r.mitigations[activeMitIdx]?.title || 'Yes') : '';

    const sorted = [...r.mitigations].sort((a, b) => {
      const ai = r.mitigations.indexOf(a);
      const bi = r.mitigations.indexOf(b);
      if (ai === activeMitIdx) return -1;
      if (bi === activeMitIdx) return 1;
      return 0;
    });
    const m1 = sorted[0];
    const m2 = sorted[1];

    lines.push([
      c(r.id), c(r.title), c(r.owner || ''), c(r.category),
      c(r.probability), c(r.impact.overall), c(r.impact.scope), c(r.impact.schedule), c(r.impact.cost),
      c(score), c(severity), c(r.description),
      c(activeMitTitle),
      c(m1?.title ?? ''), c(m1?.effort ?? ''), c(m1?.effectiveness ?? ''), c(m1?.score_delta ?? ''), c(m1?.description ?? ''),
      c(m2?.title ?? ''), c(m2?.effort ?? ''), c(m2?.effectiveness ?? ''), c(m2?.score_delta ?? ''), c(m2?.description ?? ''),
    ].join(','));
  });

  // ── Section 5: Stakeholder Register ───────────────────────────────────────
  if (stakeholders.length) {
    lines.push(sep());
    lines.push(c('STAKEHOLDER REGISTER'));
    lines.push([c('ID'), c('Name'), c('Role'), c('Power'), c('Interest'), c('Quadrant'), c('Attitude'), c('Owner'), c('Action 1'), c('Action 2'), c('Action 3')].join(','));
    stakeholders.forEach(s => {
      lines.push([
        c(s.id), c(s.name), c(s.role), c(s.power), c(s.interest), c(s.quadrant), c(s.attitude), c(s.owner || ''),
        c(s.actions?.[0] || ''), c(s.actions?.[1] || ''), c(s.actions?.[2] || ''),
      ].join(','));
    });
  }

  // ── Section 6: Dependency Register ────────────────────────────────────────
  if (dependencies.length) {
    lines.push(sep());
    lines.push(c('DEPENDENCY REGISTER'));
    lines.push([c('ID'), c('Title'), c('Owner'), c('Type'), c('From'), c('To'), c('Criticality'), c('Status'), c('Needed By'), c('Description'), c('Action')].join(','));
    dependencies.forEach(dep => {
      lines.push([
        c(dep.id), c(dep.title), c(dep.owner || ''), c(dep.type), c(dep.from), c(dep.to),
        c(dep.criticality), c(dep.status), c(dep.neededBy || ''),
        c(dep.description), c(dep.mitigation?.title || '')
      ].join(','));
    });
  }

  // ── Section 8: Scenario Analysis ──────────────────────────────────────────
  if (scenarios) {
    lines.push(sep());
    lines.push(c('SCENARIO ANALYSIS'));
    lines.push([c('Scenario'), c('Probability'), c('Timeline Delta (weeks)'), c('Cost Delta (%)'), c('Narrative')].join(','));
    [['best','Best Case'],['realistic','Realistic'],['worst','Worst Case']].forEach(([key, label]) => {
      const s = scenarios[key];
      if (!s) return;
      lines.push([c(label), c(`${s.probability}%`), c(s.timeline_delta_weeks), c(`${s.cost_delta_pct}%`), c(s.narrative)].join(','));
    });
  }

  const csv  = lines.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${projectName.replace(/\s+/g, '-')}-assessment.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function scrollToRisk(id) {
  const card = document.querySelector(`.risk-card[data-id="${id}"]`);
  if (!card) return;
  // auto-expand if collapsed
  const body = document.getElementById(`risk-body-${id}`);
  const icon = card.querySelector('.risk-expand-icon');
  if (body && body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    if (icon) icon.textContent = '▼';
    card.classList.add('expanded');
  }
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Scroll to top on tab switch ───────────────────────────────────────────────
function navOffset() {
  const header = document.querySelector('header');
  return (header ? header.offsetHeight : 0) + 16;
}

// ── Mitigation optimizer (Pro — UI wired but locked) ─────────────────────────
const EFFORT_LEVEL = { low: 1, medium: 2, high: 3 };

const OPTIMIZER_MODE_PARAMS = {
  quick:    { maxCount: 3,  maxEffort: 'low' },
  balanced: { maxCount: 6,  maxEffort: 'medium' },
  full:     { maxCount: 20, maxEffort: 'high' },
};

function optimizeMitigations(risks, maxCount, maxEffort) {
  const effortMax = EFFORT_LEVEL[maxEffort];
  const candidates = [];
  risks.forEach(r => {
    r.mitigations.forEach((m, idx) => {
      if (EFFORT_LEVEL[m.effort] <= effortMax) {
        candidates.push({ riskId: r.id, riskTitle: r.title, mitIdx: idx, mitTitle: m.title, delta: m.score_delta, effort: m.effort });
      }
    });
  });
  candidates.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const picked = [];
  const usedRisks = new Set();
  for (const c of candidates) {
    if (picked.length >= maxCount) break;
    if (usedRisks.has(c.riskId)) continue;
    picked.push(c);
    usedRisks.add(c.riskId);
  }
  return picked;
}

function renderOptimizerGuidance() {}  // kept for compatibility — no longer used
function renderCountGuidance() {}      // kept for compatibility — no longer used

function planItemIsApplied(p) {
  return activeMitigations[p.riskId] === p.mitIdx;
}

function simulatorImpactForPlan(plan) {
  if (!scenarios?.realistic || !scenarios?.best) return null;
  const sc = scenarios;

  const planDelta = plan.reduce((sum, p) => {
    const r = risks.find(x => x.id === p.riskId);
    return sum + Math.abs(r?.mitigations?.[p.mitIdx]?.score_delta ?? 0);
  }, 0);
  const maxDelta = risks.reduce((sum, r) => {
    const best = r.mitigations.length ? Math.min(...r.mitigations.map(m => m.score_delta)) : 0;
    return sum + Math.abs(best);
  }, 0);
  const ratio = maxDelta > 0 ? Math.min(planDelta / maxDelta, 1) : 0;

  const twRange = sc.realistic.timeline_delta_weeks - sc.best.timeline_delta_weeks;
  const cpRange = sc.realistic.cost_delta_pct - sc.best.cost_delta_pct;
  const adjTw = Math.round(sc.realistic.timeline_delta_weeks - twRange * ratio);
  const adjCp = Math.round(sc.realistic.cost_delta_pct - cpRange * ratio);

  return {
    baselineTw: sc.realistic.timeline_delta_weeks,
    baselineCp: sc.realistic.cost_delta_pct,
    adjTw, adjCp,
    twSaved: sc.realistic.timeline_delta_weeks - adjTw,
    cpSaved: sc.realistic.cost_delta_pct - adjCp,
  };
}

function renderBudgetResult(plan) {
  currentPlan = plan;
  const resultEl = document.getElementById('budget-result');
  if (!plan.length) {
    resultEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No mitigations found for this mode. Try a higher commitment level.</p>';
    resultEl.classList.remove('hidden');
    return;
  }

  // use same weighted formula as currentHealth() for consistency with Risk Register display
  const baseHS = currentHealth(risks);
  const planMap = Object.fromEntries(plan.map(p => [p.riskId, p.mitIdx]));
  const projectedHS = Math.round(100 - (
    weightedRiskSum(risks, r => {
      const mitIdx = planMap[r.id] !== undefined ? planMap[r.id]
                   : activeMitigations[r.id] !== undefined ? activeMitigations[r.id] : undefined;
      return mitIdx !== undefined ? r.mitigations[mitIdx].score_delta : 0;
    }) / maxWeightedRiskSum(risks)
  ) * 100);
  const gain = projectedHS - baseHS;

  const simImpact = simulatorImpactForPlan(plan);
  const fmtTw = w => w === 0 ? 'on schedule' : w > 0 ? `+${w}w` : `${w}w`;
  const fmtCp = p => p === 0 ? 'on budget' : p > 0 ? `+${p}% cost` : `${Math.abs(p)}% under budget`;

  const simBlock = simImpact ? `
    <div class="optimizer-sim-impact">
      <span class="optimizer-sim-label">Scenario Simulator impact</span>
      <span class="optimizer-sim-value">
        Forecast moves from <strong>${fmtTw(simImpact.baselineTw)} · ${fmtCp(simImpact.baselineCp)}</strong>
        to <strong>${fmtTw(simImpact.adjTw)} · ${fmtCp(simImpact.adjCp)}</strong>
        ${simImpact.twSaved > 0 ? `<span class="optimizer-sim-gain">↓ ${simImpact.twSaved}w saved</span>` : ''}
      </span>
    </div>` : '';

  const effortIcon = { low: '⚡', medium: '⚙', high: '🔧' };
  const planItems = plan.map(p => {
    const maxDelta = Math.max(...risks.flatMap(r => r.mitigations.map(m => Math.abs(m.score_delta))), 1);
    const barPct   = Math.round((Math.abs(p.delta) / maxDelta) * 100);
    return `
      <div class="optimizer-plan-item budget-plan-item" data-risk-id="${p.riskId}">
        <div class="optimizer-plan-item-header">
          <span class="optimizer-plan-risk">${esc(p.riskTitle)}</span>
          <span class="optimizer-plan-effort effort-${p.effort}">${p.effort}</span>
        </div>
        <div class="optimizer-plan-mitigation">${esc(p.mitTitle)}</div>
        <div class="optimizer-plan-bar-wrap">
          <div class="optimizer-plan-bar-track"><div class="optimizer-plan-bar" style="width:${barPct}%"></div></div>
          <span class="optimizer-plan-delta">−${Math.abs(p.delta)} pts risk</span>
        </div>
      </div>`;
  }).join('');

  resultEl.innerHTML = `
    <div class="optimizer-result-summary">
      <div class="optimizer-result-scores">
        <div class="optimizer-score-block">
          <span class="optimizer-score-label">Current Health</span>
          <span class="optimizer-score-val">${baseHS}</span>
        </div>
        <div class="optimizer-score-arrow">→</div>
        <div class="optimizer-score-block">
          <span class="optimizer-score-label">After plan</span>
          <span class="optimizer-score-val optimizer-score-target">${projectedHS} <span class="optimizer-score-gain">+${gain} pts</span></span>
        </div>
        <div class="optimizer-score-block">
          <span class="optimizer-score-label">Actions</span>
          <span class="optimizer-score-val">${plan.length}</span>
        </div>
      </div>
    </div>
    ${simBlock}
    <div class="optimizer-plan-list">${planItems}</div>
    <div class="optimizer-actions-row">
      <button class="btn-primary" id="optimizer-apply-scenarios">Apply plan &amp; see in Scenarios →</button>
      <button class="btn-secondary optimizer-send-btn" id="optimizer-send-cockpit">Send to Action Plan →</button>
    </div>`;

  resultEl.classList.remove('hidden');

  resultEl.querySelector('.optimizer-sim-link')?.addEventListener('click', e => {
    e.stopPropagation();
    switchTab('scenarios');
  });

  document.getElementById('optimizer-apply-scenarios').addEventListener('click', () => {
    plan.forEach(p => { activeMitigations[p.riskId] = p.mitIdx; });
    renderRiskList(risks);
    updateHealthScore();
    switchTab('scenarios'); // switchTab already calls renderScenariosSimulator()
    const btn = document.getElementById('optimizer-apply-scenarios');
    if (btn) { btn.textContent = '✓ Plan applied'; btn.disabled = true; }
  });

  document.getElementById('optimizer-send-cockpit').addEventListener('click', () => {
    switchTab('cockpit');
    renderQuickWins();
    const cockpitActions = document.getElementById('cockpit-quickwins');
    if (cockpitActions) cockpitActions.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const btn = document.getElementById('optimizer-send-cockpit');
    if (btn) { btn.textContent = '✓ Sent to Action Plan'; btn.disabled = true; }
  });
}

function attachPlanItemListeners(resultEl) {
  resultEl.querySelectorAll('.budget-plan-item').forEach(item => {
    item.addEventListener('click', () => {
      const riskId = parseInt(item.dataset.riskId);
      const card   = document.querySelector(`.risk-card[data-id="${riskId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const list   = document.getElementById(`mitigations-${riskId}`);
      if (list) list.classList.remove('hidden');
      card.classList.add('highlighted');
      setTimeout(() => card.classList.remove('highlighted'), 1800);
    });
  });
}

function updatePlanProgress() {
  if (!currentPlan.length) return;
  // re-render the action table in the cockpit so done states update in real time
  renderQuickWins();
  // update the progress label if it's visible in the cockpit
  const applied = currentPlan.filter(planItemIsApplied).length;
  const labelEl = document.getElementById('plan-progress-label');
  if (labelEl) labelEl.textContent = `${applied}/${currentPlan.length} applied`;
}

// optimizer mode selector
document.querySelectorAll('.optimizer-mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.optimizer-mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    optimizerMode = card.dataset.mode;
    // clear previous result when mode changes
    const resultEl = document.getElementById('budget-result');
    if (resultEl) { resultEl.innerHTML = ''; resultEl.classList.add('hidden'); }
    currentPlan = [];
  });
});

document.getElementById('run-optimizer-btn').addEventListener('click', () => {
  const { maxCount, maxEffort } = OPTIMIZER_MODE_PARAMS[optimizerMode];
  budgetCount  = maxCount;
  budgetEffort = maxEffort;
  const plan = optimizeMitigations(risks, maxCount, maxEffort);
  renderBudgetResult(plan);
});

// ── Clear mitigations ─────────────────────────────────────────────────────────
document.getElementById('clear-mitigations-btn').addEventListener('click', () => {
  Object.keys(activeMitigations).forEach(k => delete activeMitigations[k]);

  // deactivate all mitigation items visually
  document.querySelectorAll('.mitigation-item.active').forEach(el => el.classList.remove('active'));

  // reset all what-if bars
  document.querySelectorAll('.whatif-scores').forEach(el => {
    el.innerHTML = '<span class="whatif-none">Apply a mitigation to see impact</span>';
  });

  updateHealthScore();
  updatePlanProgress();
});

// ── Tier system ──────────────────────────────────────────────────────────────
let currentTier = 'free';

function renderTeaserPreview() {
  const el = document.getElementById('teaser-preview-content');
  if (!el || !risks.length) return;
  const plan        = optimizeMitigations(risks, 3, 'medium');
  const baseHS      = healthScore(risks);
  const maxPossible = risks.length * 9;
  const planMap     = Object.fromEntries(plan.map(p => [p.riskId, p.mitIdx]));
  const simActual   = risks.reduce((sum, r) => {
    const mitIdx = planMap[r.id];
    const delta  = mitIdx !== undefined ? r.mitigations[mitIdx].score_delta : 0;
    return sum + Math.max(1, riskScore(r) + delta);
  }, 0);
  const projectedHS = Math.round(100 - (simActual / maxPossible) * 100);
  el.innerHTML = `
    <div class="budget-result-plan" style="margin-bottom:10px">
      ${plan.slice(0, 3).map((p, i) => `
        <div class="budget-plan-item" style="margin-bottom:6px">
          <span class="budget-plan-num">${i + 1}</span>
          <div class="budget-plan-body">
            <span class="budget-plan-risk">${esc(p.riskTitle)}</span>
            <span class="budget-plan-mit">→ ${esc(p.mitTitle)}</span>
          </div>
          <span class="budget-plan-delta">${p.delta} pts</span>
        </div>`).join('')}
    </div>
    <div style="font-size:0.82rem">
      Health Score: <strong>${baseHS}</strong> → <strong style="color:var(--low)">${projectedHS}</strong>
      <span style="color:var(--low);font-weight:700"> +${projectedHS - baseHS} pts</span>
    </div>`;
}

function applyTier(tier) {
  currentTier = tier;

  // optimizer
  const teaser = document.getElementById('budget-teaser');
  const full   = document.getElementById('budget-full');
  if (teaser && full) {
    teaser.classList.toggle('hidden', tier === 'pro');
    full.classList.toggle('hidden', tier === 'free');
    if (tier === 'free') renderTeaserPreview();
  }

  // add risk
  const addFree = document.getElementById('add-risk-free');
  const addPro  = document.getElementById('add-risk-pro');
  if (addFree && addPro) {
    addFree.classList.toggle('hidden', tier === 'pro');
    addPro.classList.toggle('hidden',  tier === 'free');
  }

  // add dep
  const depFree = document.getElementById('add-dep-free');
  const depPro  = document.getElementById('add-dep-pro');
  if (depFree && depPro) {
    depFree.classList.toggle('hidden', tier === 'pro');
    depPro.classList.toggle('hidden',  tier === 'free');
  }

  // add stakeholder
  const shFree = document.getElementById('add-stakeholder-free');
  const shPro  = document.getElementById('add-stakeholder-pro');
  if (shFree && shPro) {
    shFree.classList.toggle('hidden', tier === 'pro');
    shPro.classList.toggle('hidden',  tier === 'free');
  }

  // scenarios Pro features
  const scTeaser = document.getElementById('scenarios-pro-teaser');
  const scComp   = document.getElementById('scenarios-comparison-pro');
  const scMit    = document.getElementById('scenarios-mitigations-pro');
  const scSim    = document.getElementById('scenarios-simulator-pro');
  if (scTeaser) scTeaser.classList.toggle('hidden', tier === 'pro');
  if (scComp)   scComp.classList.toggle('hidden',   tier === 'free');
  if (scMit)    scMit.classList.toggle('hidden',    tier === 'free');
  if (scSim)    scSim.classList.toggle('hidden',    tier === 'free');

  // export
  const expFree = document.getElementById('export-free');
  const expPro  = document.getElementById('export-pro');
  if (expFree && expPro) {
    expFree.classList.toggle('hidden', tier === 'pro');
    expPro.classList.toggle('hidden',  tier === 'free');
  }

  document.querySelectorAll('.tier-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tier === tier);
  });

  // cockpit free nudge
  const nudge = document.getElementById('cockpit-free-nudge');
  if (nudge) nudge.classList.toggle('hidden', tier === 'pro');
}

// always show tier switch
{
  document.getElementById('tier-switch').classList.remove('hidden');
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTier(btn.dataset.tier);
      renderCockpitScores();
    });
  });

  document.getElementById('cockpit-free-nudge')?.querySelector('.nudge-upgrade-link')?.addEventListener('click', e => {
    e.preventDefault();
    applyTier('pro');
    renderCockpitScores();
  });
}

// ── Module Tab Navigation ────────────────────────────────────────────────────
function switchTab(module, skipScroll = false) {
  currentModule = module;
  document.querySelectorAll('.module-tab').forEach(t => t.classList.toggle('tab-active', t.dataset.module === module));
  document.querySelectorAll('.module-section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`module-${module}`);
  if (target) target.classList.remove('hidden');
  if (!skipScroll) window.scrollTo({ top: 0, behavior: 'smooth' });

  // update simulator when visiting scenarios
  if (module === 'scenarios') renderScenariosSimulator();
}

document.addEventListener('click', e => {
  const tab = e.target.closest('.module-tab');
  if (tab) switchTab(tab.dataset.module);

  const cockpitBtn = e.target.closest('.cockpit-card-btn');
  if (cockpitBtn) switchTab(cockpitBtn.dataset.module);

  const outlookLink = e.target.closest('.outlook-link[data-module]');
  if (outlookLink) {
    switchTab(outlookLink.dataset.module);
    const scrollTo = outlookLink.dataset.scrollTo;
    if (scrollTo) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = document.getElementById(scrollTo);
        if (!target) return;
        const headerH = document.querySelector('header')?.offsetHeight || 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      }));
    }
  }

  const simLink = e.target.closest('.sim-link[data-module]');
  if (simLink) switchTab(simLink.dataset.module);

  const quickwin = e.target.closest('.action-row[data-module]');
  if (quickwin && !e.target.closest('.owner-input')) {
    switchTab(quickwin.dataset.module, !!quickwin.dataset.itemId);
    if (quickwin.dataset.subtab) {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === quickwin.dataset.subtab));
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));
      const subtabEl = document.getElementById(`subtab-${quickwin.dataset.subtab}`);
      if (subtabEl) subtabEl.classList.remove('hidden');
    }
    // scroll + highlight al item concreto
    const itemId = quickwin.dataset.itemId;
    if (itemId) {
      // esperar a que el tab y subtab estén visibles antes de scroll
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.getElementById(itemId);
        if (!el) return;
        const idNum = itemId.split('-').pop();
        const bodyId = itemId.startsWith('risk-card-') ? `risk-body-${idNum}`
                     : itemId.startsWith('issue-card-') ? `issue-body-${idNum}`
                     : itemId.startsWith('dep-card-') ? `dep-body-${idNum}` : null;
        const body = bodyId ? document.getElementById(bodyId) : null;
        if (body && body.classList.contains('hidden')) {
          body.classList.remove('hidden');
          const icon = el.querySelector('.risk-expand-icon');
          if (icon) icon.textContent = '▼';
          el.classList.add('expanded');
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('item-highlight');
        setTimeout(() => el.classList.remove('item-highlight'), 2000);
      }));
    }
  }
});

// ── Subtab Navigation ────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.subtab-btn');
  if (!btn) return;
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));
  const target = document.getElementById(`subtab-${btn.dataset.subtab}`);
  if (target) target.classList.remove('hidden');
});

// ── PM Cockpit ────────────────────────────────────────────────────────────────
function cockpitScore() {
  const rScore = risks.length        ? currentHealth(risks)   : null;
  const dScore = dependencies.length ? depsHealth()           : null;
  const sScore = stakeholders.length ? stakeholdersHealth()   : null;
  const scScore = scenarios          ? scenarios.realistic?.probability ?? null : null;

  if (rScore === null) return null;

  let weighted = 0; let totalWeight = 0;
  weighted += rScore * 0.4; totalWeight += 0.4;
  if (dScore !== null) { weighted += dScore * 0.3; totalWeight += 0.3; }
  if (sScore !== null) { weighted += sScore * 0.2; totalWeight += 0.2; }
  if (scScore !== null) {
    // scenarios: higher realistic probability of good outcome = better score
    // realistic probability is "probability of realistic scenario" — we want best probability high
    const scenScore = Math.min(100, (scenarios.best?.probability || 25) * 2);
    weighted += scenScore * 0.1; totalWeight += 0.1;
  }

  return Math.round(weighted / totalWeight);
}

function cockpitScoreProjected() {
  if (!risks.length) return null;

  // only project what is in the current plan and not yet applied
  // if no plan, nothing to project
  if (!currentPlan.length) return null;

  const pendingPlan = currentPlan.filter(p => !planItemIsApplied(p));
  // if everything in the plan is already applied, nothing left to project
  if (!pendingPlan.length) return null;

  const pendingMap = Object.fromEntries(pendingPlan.map(p => [p.riskId, p.mitIdx]));

  // simulate applying only the pending plan items on top of currently active mitigations
  const simActual = weightedRiskSum(risks, r => {
    // already applied mitigation takes precedence
    if (activeMitigations[r.id] !== undefined) {
      return r.mitigations[activeMitigations[r.id]].score_delta;
    }
    // pending plan item
    if (pendingMap[r.id] !== undefined) {
      return r.mitigations[pendingMap[r.id]].score_delta;
    }
    return 0;
  });
  const rProj = Math.round(100 - (simActual / maxWeightedRiskSum(risks)) * 100);

  // deps projected
  const pinnedActiveDeps = pinnedDepIds.some(id => {
    const dep = dependencies.find(d => d.id === id);
    return dep && dep.status !== 'resolved';
  });
  const dCurrent = dependencies.length ? depsHealth() : null;
  const dProj = (dependencies.length && pinnedActiveDeps) ? 100 : dCurrent;

  const sScore = stakeholders.length ? stakeholdersHealth() : null;

  let weighted = 0; let totalWeight = 0;
  weighted += rProj * 0.4; totalWeight += 0.4;
  if (dProj !== null) { weighted += dProj * 0.3; totalWeight += 0.3; }
  if (sScore !== null) { weighted += sScore * 0.2; totalWeight += 0.2; }

  return Math.round(weighted / totalWeight);
}

function issuesHealth() {
  const active = issues.filter(i => i.status !== 'closed');
  if (!active.length) return 100;
  const actual = active.reduce((sum, iss) => {
    const s = LEVEL[iss.probability] * LEVEL[iss.impact.overall];
    const escalationMult = iss.status === 'escalated' ? 1.6 : 1.0;
    return sum + s * escalationMult * riskWeight(s);
  }, 0);
  const max = active.length * 9 * riskWeight(9) * 1.0; // baseline: all non-escalated critical
  return Math.round(100 - (actual / max) * 100);
}

function depsHealth() {
  const active = dependencies.filter(d => d.status !== 'resolved');
  if (!active.length) return 100;
  // weighted penalty per status × criticality
  const critWeight = { critical: 2.0, high: 1.5, medium: 1.0, low: 0.6 };
  const statusPenalty = { blocked: 1.0, 'at-risk': 0.5, 'on-track': 0.0 };
  const totalPenalty = active.reduce((sum, d) => {
    const cw = critWeight[d.criticality] || 1.0;
    const sp = statusPenalty[d.status] ?? 0;
    return sum + cw * sp;
  }, 0);
  const maxPenalty = active.reduce((sum, d) => sum + (critWeight[d.criticality] || 1.0) * 1.0, 0);
  return Math.round(100 - (totalPenalty / maxPenalty) * 100);
}

function readinessLevel(score) {
  if (score >= 86) return { level: 'OPTIMIZED',   cls: 'level-optimized' };
  if (score >= 66) return { level: 'CONTROLLED',  cls: 'level-controlled' };
  if (score >= 41) return { level: 'DEVELOPING',  cls: 'level-developing' };
  return            { level: 'CRITICAL',    cls: 'level-critical' };
}

function renderCockpitScores() {
  const global = cockpitScore();

  // readiness badge
  const badge     = document.getElementById('readiness-badge');
  const scoreEl   = document.getElementById('readiness-score');
  const levelEl   = document.getElementById('readiness-level');
  const trendEl   = document.getElementById('readiness-trend');
  const prevScore = parseInt(scoreEl.textContent) || 0;

  badge.className = 'readiness-badge';
  if (global !== null) {
    const rl = readinessLevel(global);
    badge.classList.add(rl.cls);
    levelEl.textContent = rl.level;
    scoreEl.textContent = global;
    const delta = global - prevScore;
    if (trendEl) {
      if (delta > 0) { trendEl.textContent = `↑ +${delta} pts`; trendEl.className = 'readiness-trend trend-up'; }
      else if (delta < 0) { trendEl.textContent = `↓ ${delta} pts`; trendEl.className = 'readiness-trend trend-down'; }
      else { trendEl.textContent = ''; }
    }
    if (delta > 0) {
      scoreEl.classList.remove('flash');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('flash');
    }

    // optimize nudge — show when Pro, score < 70, no plan active yet
    const optimizeBtn = document.getElementById('btn-optimize-nudge');
    if (optimizeBtn) {
      const showNudge = currentTier === 'pro' && global !== null && global < 70 && currentPlan.length === 0;
      optimizeBtn.classList.toggle('hidden', !showNudge);
    }

    // projected score
    const projEl = document.getElementById('readiness-projected');
    if (projEl) {
      const proj = cockpitScoreProjected();
      const gain = proj !== null ? proj - global : 0;
      if (proj !== null && gain > 0) {
        projEl.innerHTML = `If plan applied: <strong>${proj}</strong> <span class="proj-gain">+${gain} pts</span>`;
        projEl.classList.remove('hidden');
      } else {
        projEl.classList.add('hidden');
      }
    }
  } else {
    badge.classList.add('level-incomplete');
    levelEl.textContent = 'INCOMPLETE';
    scoreEl.textContent = '—';
    if (trendEl) trendEl.textContent = '';
    document.getElementById('readiness-projected')?.classList.add('hidden');
  }

  const rScore = risks.length        ? currentHealth(risks) : null;
  const dScore = dependencies.length ? depsHealth()         : null;
  const sScore = stakeholders.length ? stakeholdersHealth() : null;

  // breakdown under global score — shows component weights
  const bdEl = document.getElementById('readiness-breakdown');
  if (bdEl) {
    bdEl.textContent = 'Risks 40% · Deps 30% · Stakeholders 20% · Scenarios 10%';
    bdEl.classList.remove('hidden');
  }

  // risks card
  if (rScore !== null) {
    document.getElementById('cockpit-risks-score').textContent = rScore;
    document.getElementById('cockpit-risks-meta').textContent  = `${risks.length} risks · ${risks.filter(r => scoreLabel(riskScore(r)) === 'critical').length} critical`;
    document.getElementById('cockpit-risks-bar').style.width   = rScore + '%';
  }

  // stakeholders card
  if (sScore !== null) {
    const resistant = stakeholders.filter(s => s.attitude === 'resistant').length;
    document.getElementById('cockpit-stakeholders-score').textContent = sScore;
    document.getElementById('cockpit-stakeholders-meta').textContent  = `${stakeholders.length} stakeholders · ${resistant} resistant`;
    document.getElementById('cockpit-stakeholders-bar').style.width   = sScore + '%';
  }

  // deps card
  if (dScore !== null) {
    const blocked = dependencies.filter(d => d.status === 'blocked').length;
    document.getElementById('cockpit-deps-score').textContent = dScore;
    document.getElementById('cockpit-deps-meta').textContent  = `${dependencies.length} dependencies · ${blocked} blocked`;
    document.getElementById('cockpit-deps-bar').style.width   = dScore + '%';
  }

  // scenarios card
  if (scenarios) {
    const sc = scenarios;
    const fmtTw = w => w === 0 ? 'On time' : w > 0 ? `+${w}w` : `${w}w`;
    const fmtCp = p => p === 0 ? 'On budget' : p > 0 ? `+${p}%` : `${p}%`;
    const scenScore = Math.min(100, (sc.best?.probability || 25) * 2);
    document.getElementById('cockpit-scenarios-score').textContent = fmtTw(sc.realistic?.timeline_delta_weeks ?? 0);
    document.getElementById('cockpit-scenarios-meta').textContent  = `Realistic · ${fmtCp(sc.realistic?.cost_delta_pct ?? 0)} cost`;
    document.getElementById('cockpit-scenarios-bar').style.width   = scenScore + '%';
  }

  renderPulseBar();
  renderImpactMatrix();
  renderProjectOutlook();
  renderStakeholderPulse();
  renderQuickWins();
}

// ── Project Pulse Bar ─────────────────────────────────────────────────────────
function renderPulseBar() {
  // timeline
  if (projectStart && projectEnd) {
    const start    = new Date(projectStart);
    const end      = new Date(projectEnd);
    const today    = new Date();
    const total    = Math.max(1, Math.round((end - start) / 864e5));
    const elapsed  = Math.max(0, Math.round((today - start) / 864e5));
    const remaining = Math.max(0, Math.round((end - today) / 864e5));
    const pct      = Math.min(100, Math.round((elapsed / total) * 100));
    const tlEl = document.getElementById('pulse-timeline');
    const tlSub = document.getElementById('pulse-timeline-sub');
    if (tlEl) tlEl.textContent = remaining > 0 ? `${remaining}d left` : 'Overdue';
    if (tlSub) tlSub.textContent = `${pct}% elapsed`;
    if (tlEl) tlEl.className = 'pulse-value' + (remaining <= 30 ? ' pulse-value-alert' : remaining <= 60 ? ' pulse-value-warn' : '');
  }

  // critical risks
  const critRisks = risks.filter(r => scoreLabel(riskScore(r)) === 'critical').length;
  const critEl = document.getElementById('pulse-critical');
  const critSub = document.getElementById('pulse-critical-sub');
  if (critEl) { critEl.textContent = critRisks; critEl.className = 'pulse-value' + (critRisks > 0 ? ' pulse-value-alert' : ' pulse-value-positive'); }
  if (critSub) critSub.textContent = critRisks > 0 ? 'need attention' : 'none';

  // resistant stakeholders
  const resistant = stakeholders.filter(s => s.attitude === 'resistant').length;
  const resEl = document.getElementById('pulse-resistant');
  if (resEl) { resEl.textContent = resistant; resEl.className = 'pulse-value' + (resistant > 0 ? ' pulse-value-warn' : ''); }

  // blocked deps
  const blocked = dependencies.filter(d => d.status === 'blocked').length;
  const blkEl = document.getElementById('pulse-blocked');
  if (blkEl) { blkEl.textContent = blocked; blkEl.className = 'pulse-value' + (blocked > 0 ? ' pulse-value-warn' : ''); }

  // mitigations applied
  const mitEl = document.getElementById('pulse-mitigations');
  if (mitEl) { mitEl.textContent = Object.keys(activeMitigations).length; }

  // coverage (4 modules)
  const modules = [risks.length > 0, stakeholders.length > 0, dependencies.length > 0, scenarios !== null].filter(Boolean).length;
  const covEl = document.getElementById('pulse-coverage');
  if (covEl) covEl.textContent = modules;
}

// ── Impact Breakdown — exposure table ────────────────────────────────────────
function renderImpactMatrix() {
  const container = document.getElementById('impact-breakdown');
  if (!container) return;
  if (!risks.length) { container.innerHTML = ''; return; }

  const activeDeps = dependencies.filter(d => d.status !== 'resolved');

  const dims = [
    {
      label: 'Schedule',
      items: [
        ...risks.map(r => r.impact.schedule),
        ...activeDeps.filter(d => d.status !== 'on-track').map(() => 'high'),
        ...activeDeps.filter(d => d.status === 'on-track').map(() => 'low'),
      ]
    },
    { label: 'Scope', items: risks.map(r => r.impact.scope) },
    { label: 'Cost',  items: risks.map(r => r.impact.cost)  },
  ];

  const worstDim = dims.reduce((a, b) => {
    const aHigh = a.items.filter(v => v === 'high').length;
    const bHigh = b.items.filter(v => v === 'high').length;
    return bHigh > aHigh ? b : a;
  }).label;

  container.innerHTML = `
    <table class="exposure-table">
      <thead>
        <tr>
          <th class="exp-dim-col"></th>
          <th class="exp-val-col exp-high">High</th>
          <th class="exp-val-col exp-medium">Medium</th>
          <th class="exp-val-col exp-low">Low</th>
          <th class="exp-val-col exp-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${dims.map(({ label, items }) => {
          const high   = items.filter(v => v === 'high').length;
          const medium = items.filter(v => v === 'medium').length;
          const low    = items.filter(v => v === 'low').length;
          const total  = items.length;
          const isWorst = label === worstDim;
          return `
            <tr class="${isWorst ? 'exp-row-worst' : ''}">
              <td class="exp-dim">${label}${isWorst ? ' <span class="exp-worst-badge">most exposed</span>' : ''}</td>
              <td class="exp-val exp-high">${high > 0 ? `<strong>${high}</strong>` : '<span class="exp-zero">—</span>'}</td>
              <td class="exp-val exp-medium">${medium > 0 ? medium : '<span class="exp-zero">—</span>'}</td>
              <td class="exp-val exp-low">${low > 0 ? low : '<span class="exp-zero">—</span>'}</td>
              <td class="exp-val exp-total">${total}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderQuickWins() {
  const container = document.getElementById('quickwins-list');
  if (!container) return;
  const wins = [];
  const hasOptimizerPlan = currentPlan.length > 0;

  if (hasOptimizerPlan) {
    // Optimizer plan is the source of truth for risk mitigations
    currentPlan.forEach((p, i) => {
      const done = planItemIsApplied(p);
      wins.push({
        icon: done ? '✓' : '⚡',
        text: `<strong>${esc(p.mitTitle)}</strong>`,
        source: esc(p.riskTitle),
        module: 'risks',
        itemId: `risk-card-${p.riskId}`,
        tag: 'optimizer',
        done,
        delta: p.delta,
        effort: p.effort,
      });
    });
  } else {
    // fallback: top 2 high/critical risks
    risks
      .filter(r => ['high','critical'].includes(scoreLabel(riskScore(r))))
      .sort((a, b) => riskScore(b) - riskScore(a))
      .slice(0, 2)
      .forEach(r => {
        const best = r.mitigations.length
          ? r.mitigations.reduce((a, b) => a.score_delta < b.score_delta ? a : b)
          : null;
        const done = activeMitigations[r.id] !== undefined;
        wins.push({
          icon: done ? '✓' : '⚠️',
          text: best ? `Apply mitigation: <strong>${esc(best.title)}</strong>` : `Mitigate risk: <strong>${esc(r.title)}</strong>`,
          source: r.title,
          module: 'risks',
          itemId: `risk-card-${r.id}`,
          done,
        });
      });
  }

  // pinned dependencies — fixed at load time, marked done when resolved
  pinnedDepIds.forEach(id => {
    const dep = dependencies.find(d => d.id === id);
    if (!dep) return;
    const done = dep.status === 'resolved';
    wins.push({
      icon: done ? '✓' : '🚧',
      text: `Unblock dependency: <strong>${esc(dep.title)}</strong>`,
      source: 'Dependencies',
      module: 'dependencies',
      itemId: `dep-card-${dep.id}`,
      done,
    });
  });

  // resistant stakeholders — top 2
  stakeholders.filter(s => s.attitude === 'resistant').slice(0, 2).forEach(s => {
    wins.push({
      icon: '⚠️',
      text: `Engage resistant stakeholder: <strong>${esc(s.name)}</strong>`,
      source: 'Stakeholders',
      module: 'stakeholders',
      itemId: `sh-card-${s.id}`,
      done: false,
    });
  });

  if (!wins.length) {
    container.innerHTML = '<p class="quickwins-empty">No critical actions identified. Your project is well-controlled.</p>';
    return;
  }

  const planApplied = hasOptimizerPlan ? currentPlan.filter(planItemIsApplied).length : 0;
  const planTotal   = currentPlan.length;
  const headerExtra = hasOptimizerPlan
    ? `<span class="action-plan-badge">Optimizer plan · <span id="plan-progress-label">${planApplied}/${planTotal} applied</span></span>`
    : '';

  container.innerHTML = `
    <div class="action-table-header-row">
      ${headerExtra}
    </div>
    <table class="action-table">
      <thead>
        <tr>
          <th></th>
          <th>Action</th>
          <th>Source</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${wins.map(w => `
          <tr class="action-row${w.done ? ' action-row-done' : ''}" data-module="${w.module}" ${w.subtab ? `data-subtab="${w.subtab}"` : ''} data-item-id="${w.itemId || ''}">
            <td class="action-icon">${w.icon}</td>
            <td class="action-text">
              ${w.tag === 'optimizer' ? `<span class="action-tag-optimizer">Optimizer</span>` : ''}
              ${w.text}
              ${w.delta ? `<span class="action-delta">${w.delta} pts</span>` : ''}
            </td>
            <td class="action-source">${w.source}</td>
            <td class="action-go">${w.done ? '<span class="action-done-label">Done</span>' : '<span class="quickwin-cta">Go →</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}


// ── Full Assessment API call (lazy, Pro) ─────────────────────────────────────
function buildIssuesDepsPrompt() {
  const duration = Math.round((new Date(projectEnd) - new Date(projectStart)) / (1000 * 60 * 60 * 24 * 30));
  const industryLine = projectIndustry ? `Industry: ${projectIndustry}` : '';
  return `You are an expert project analyst with 15+ years of experience managing complex programs.

Analyze this project and identify active issues and dependencies:
Project Scope: ${projectScope}
Duration: ${duration} months (${projectStart} to ${projectEnd})
Budget: ${projectCurrency}${Number(projectBudget).toLocaleString()}
${industryLine}

Return ONLY a valid JSON object with this exact structure:
{
  "issues": [
    {
      "id": 1,
      "title": "string (max 10 words)",
      "description": "string (2-3 sentences)",
      "category": "Schedule|Budget|Scope|Resource|Technical",
      "probability": "low|medium|high",
      "impact": { "overall": "low|medium|high", "schedule": "low|medium|high", "cost": "low|medium|high" },
      "status": "open|in-progress|escalated",
      "resolution": { "title": "string", "effort": "low|medium|high", "effectiveness": "low|medium|high", "score_delta": -2 }
    }
  ],
  "dependencies": [
    {
      "id": 1,
      "title": "string (max 10 words)",
      "description": "string (1-2 sentences)",
      "type": "internal|external|technical|vendor",
      "from": "string (team or system)",
      "to": "string (team or system)",
      "criticality": "low|medium|high|critical",
      "status": "on-track|at-risk|blocked",
      "mitigation": { "title": "string", "effort": "low|medium|high", "score_delta": -1 }
    }
  ]
}

Rules:
- Generate 4-6 issues and 4-6 dependencies, specific to this project
- score_delta must be negative (-1 to -3)
- Return only the JSON, no markdown fences`;
}

const FA_LOADING_MESSAGES = [
  'Scanning for active issues...',
  'Mapping dependency chains...',
  'Identifying blockers...',
  'Assessing escalation risks...',
  'Checking cross-team dependencies...',
  'Evaluating issue severity...',
  'Detecting hidden blockers...',
  'Analyzing dependency criticality...',
  'Reviewing open action items...',
  'Prioritizing by impact...',
];

let faLoadingInterval = null;

function startFALoadingMessages() {
  const el = document.getElementById('full-assessment-loading-msg');
  if (!el) return;
  let i = 0;
  el.textContent = FA_LOADING_MESSAGES[0];
  faLoadingInterval = setInterval(() => {
    i = (i + 1) % FA_LOADING_MESSAGES.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = FA_LOADING_MESSAGES[i];
      el.style.opacity = '1';
    }, 300);
  }, 3000);
}

function stopFALoadingMessages() {
  clearInterval(faLoadingInterval);
  faLoadingInterval = null;
}

async function generateIssuesDeps() {
  if (issuesDepLoaded || issuesDepLoading) return;
  issuesDepLoading = true;

  const loading = document.getElementById('full-assessment-loading');
  if (loading) loading.classList.remove('hidden');
  startFALoadingMessages();

  try {
    let data;
    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 1800));
      data = JSON.parse(JSON.stringify(MOCK_ISSUES_DEPS));
    } else {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: buildIssuesDepsPrompt() }] })
      });
      const json = await response.json();
      let text = json.choices[0].message.content.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      data = JSON.parse(text);
    }

    issues       = data.issues || [];
    dependencies = data.dependencies || [];
    issuesDepLoaded  = true;
    issuesDepLoading = false;

    // pin issues for Priority Actions:
    // — all escalated (no limit, always critical)
    // — up to 1 open/in-progress as complement
    const escalatedIssues = issues.filter(i => i.status === 'escalated');
    const otherIssues     = issues.filter(i => i.status === 'open' || i.status === 'in-progress').slice(0, 1);
    pinnedIssueIds = [...escalatedIssues, ...otherIssues].map(i => i.id);

    // pin dependencies:
    // — all blocked (no limit, always critical)
    // — up to 1 at-risk as complement
    const blockedDeps  = dependencies.filter(d => d.status === 'blocked');
    const atRiskDeps   = dependencies.filter(d => d.status === 'at-risk').slice(0, 1);
    pinnedDepIds = [...blockedDeps, ...atRiskDeps].map(d => d.id);

    stopFALoadingMessages();
    if (loading) loading.classList.add('hidden');
    renderIssuesList();
    renderIssuesHeatmap();
    renderIssuesCoverage();
    renderDependenciesList();
    renderDepsCoverage();
    document.getElementById('issues-health-score').textContent = issuesHealth();
    document.getElementById('deps-health-score').textContent   = depsHealth();
    document.getElementById('readiness-incomplete')?.classList.add('hidden');
    renderCockpitScores();
    applyFullAssessmentTier(currentTier);
    setupAddIssue();
    setupAddDep();
    wireIssueFilters();

  } catch (err) {
    stopFALoadingMessages();
    issuesDepLoading = false;
    if (loading) loading.classList.add('hidden');
    const container = document.getElementById('issues-list');
    if (container) container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Could not generate Full Assessment.</p>';
    showError(
      'Full Assessment failed',
      err.message || 'Could not analyze issues and dependencies. Try switching to this tab again.',
      () => { issuesDepLoaded = false; issuesDepLoading = false; generateIssuesDeps(); }
    );
  }
}


// ── Issues Render ─────────────────────────────────────────────────────────────
let activeIssueFilter = 'all';
let activeIssueCategoryFilter = null;
let activeIssueHeatmapCell = null;
let activeDepFilter = 'all';

function renderIssuesList() {
  const container = document.getElementById('issues-list');
  if (!container) return;
  container.innerHTML = '';

  // separate closed from active
  const closed  = issues.filter(iss => iss.status === 'closed');
  const active  = issues.filter(iss => iss.status !== 'closed');

  // render closed section
  const closedSection = document.getElementById('closed-issues-section');
  const closedList    = document.getElementById('closed-issues-list');
  const closedLabel   = document.getElementById('closed-issues-label');
  const closedToggle  = document.getElementById('closed-issues-toggle');
  if (closedSection) {
    closedSection.classList.toggle('hidden', closed.length === 0);
    const isExpanded = closedList && !closedList.classList.contains('hidden');
    if (closedLabel) closedLabel.textContent = `${isExpanded ? '▼' : '▶'} Closed issues (${closed.length})`;
    if (closedList) {
      closedList.innerHTML = '';
      closed.forEach(iss => closedList.appendChild(buildIssueCard(iss, true)));
      wireIssueCards(closedList);
    }
    if (closedToggle) {
      closedToggle.onclick = () => {
        const open = !closedList.classList.contains('hidden');
        closedList.classList.toggle('hidden', open);
        closedLabel.textContent = (open ? '▶' : '▼') + ` Closed issues (${closed.length})`;
      };
    }
  }

  const filtered = active.filter(iss => {
    if (activeIssueFilter !== 'all' && iss.status !== activeIssueFilter) return false;
    if (activeIssueCategoryFilter && iss.category !== activeIssueCategoryFilter) return false;
    if (activeIssueHeatmapCell && (iss.probability !== activeIssueHeatmapCell.prob || iss.impact.overall !== activeIssueHeatmapCell.imp)) return false;
    return true;
  });

  filtered.forEach(iss => container.appendChild(buildIssueCard(iss, false)));

  wireIssueCards(container);

  // toggle handlers — also wire closed list
  const closedListEl = document.getElementById('closed-issues-list');
  if (closedListEl) wireIssueCards(closedListEl);
}

function buildIssueCard(iss, isClosed) {
  const sev = scoreLabel(LEVEL[iss.probability] * LEVEL[iss.impact.overall]);
  const card = document.createElement('div');
  card.className = `issue-card status-${iss.status}${isClosed ? ' issue-closed' : ''}`;
  card.id = `issue-card-${iss.id}`;
  card.innerHTML = `
    <div class="issue-card-toggle" data-issue-id="${iss.id}">
      <div class="issue-card-header">
        <div class="risk-header-left">
          <span class="risk-expand-icon">▶</span>
          <span class="issue-card-title">${iss.title}</span>
        </div>
        <div class="risk-badges">
          <span class="issue-status-badge ${iss.status}">${iss.status.replace('-', ' ')}</span>
          ${!isClosed ? `<span class="issue-status-badge ${sev}">${sev}</span>
          <span class="issue-status-badge" style="background:var(--surface2);color:var(--text-muted);border-color:var(--border)">prob: ${iss.probability}</span>
          ${iss.dueDate ? `<span class="owner-date-badge ${new Date(iss.dueDate) < new Date() ? 'date-overdue' : ''}">📅 ${iss.dueDate}</span>` : ''}
          <input class="owner-input" type="text" placeholder="Owner" value="${iss.owner || ''}" data-owner-issue="${iss.id}" title="Assign owner" />
          <button class="btn-close-item" data-close-issue="${iss.id}" title="Mark as closed">✓ Close</button>
          <button class="risk-edit-btn" data-edit-issue="${iss.id}" title="Edit this issue">✏️ Edit issue</button>`
          : `<button class="btn-reopen-item" data-reopen-issue="${iss.id}" title="Reopen this issue">↩ Reopen</button>`}
        </div>
      </div>
    </div>
    <div class="issue-card-body hidden" id="issue-body-${iss.id}">
      <p class="risk-description">${iss.description}</p>
      <div class="issue-resolution">
        <div class="issue-resolution-title">Resolution</div>
        <div class="issue-resolution-text">${iss.resolution.title}</div>
      </div>
      <div class="risk-impact-row" style="margin-top:10px">
        <span class="impact-tag">Probability: <strong>${iss.probability}</strong></span>
        <span class="impact-tag">Schedule: <strong>${iss.impact.schedule}</strong></span>
        <span class="impact-tag">Cost: <strong>${iss.impact.cost}</strong></span>
        <span class="impact-tag due-date-field">Due date: <input type="date" class="inline-date-input" data-due-issue="${iss.id}" value="${iss.dueDate || ''}" title="Expected resolution date" /></span>
      </div>
    </div>`;
  return card;
}

function wireIssueCards(container) {
  // toggle handlers
  container.querySelectorAll('.issue-card-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      if (e.target.closest('.btn-edit-risk') || e.target.closest('.risk-edit-form')) return;
      const id = toggle.dataset.issueId;
      const body = document.getElementById(`issue-body-${id}`);
      const icon = toggle.querySelector('.risk-expand-icon');
      const card = toggle.closest('.issue-card');
      const open = !body.classList.contains('hidden');
      // cerrar también elimina el form si existe
      if (!open) { const f = body.querySelector('.risk-edit-form'); if (f) f.remove(); }
      body.classList.toggle('hidden', open);
      if (icon) icon.textContent = open ? '▶' : '▼';
      card.classList.toggle('expanded', !open);
    });
  });

  // owner input
  container.querySelectorAll('.owner-input[data-owner-issue]').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      const iss = issues.find(x => x.id === parseInt(input.dataset.ownerIssue));
      if (iss) iss.owner = input.value.trim();
    });
  });

  // due date
  container.querySelectorAll('[data-due-issue]').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      const iss = issues.find(x => x.id === parseInt(input.dataset.dueIssue));
      if (iss) {
        iss.dueDate = input.value;
        renderIssuesList();
      }
    });
  });

  // close buttons
  container.querySelectorAll('[data-close-issue]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const iss = issues.find(x => x.id === parseInt(btn.dataset.closeIssue));
      if (iss) { iss.status = 'closed'; }
      renderIssuesList();
      renderIssuesHeatmap();
      renderIssuesCoverage();
      document.getElementById('issues-health-score').textContent = issuesHealth();
      renderCockpitScores();
      renderQuickWins();
    });
  });

  // reopen buttons
  container.querySelectorAll('[data-reopen-issue]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const iss = issues.find(x => x.id === parseInt(btn.dataset.reopenIssue));
      if (iss) { iss.status = 'open'; }
      renderIssuesList();
      renderIssuesHeatmap();
      renderIssuesCoverage();
      document.getElementById('issues-health-score').textContent = issuesHealth();
      renderCockpitScores();
      renderQuickWins();
    });
  });

  // edit buttons (en header, igual que risks)
  container.querySelectorAll('.risk-edit-btn[data-edit-issue]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.editIssue);
      const body = document.getElementById(`issue-body-${id}`);
      if (body && body.classList.contains('hidden')) body.classList.remove('hidden');
      const icon = btn.closest('.issue-card').querySelector('.risk-expand-icon');
      if (icon) icon.textContent = '▼';
      btn.closest('.issue-card').classList.add('expanded');
      openEditIssue(id);
    });
  });

}

function wireIssueFilters() {
  document.querySelectorAll('[data-issue-filter]').forEach(btn => {
    btn.onclick = () => {
      activeIssueFilter = btn.dataset.issueFilter;
      activeIssueHeatmapCell = null;
      document.querySelectorAll('[data-issue-filter]').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#issues-heatmap-grid .heatmap-cell').forEach(c => c.classList.remove('selected','dimmed'));
      renderIssuesList();
    };
  });

  document.querySelectorAll('.issues-coverage-item').forEach(item => {
    item.onclick = () => {
      const cat = item.dataset.category;
      activeIssueCategoryFilter = activeIssueCategoryFilter === cat ? null : cat;
      document.querySelectorAll('.issues-coverage-item').forEach(i => i.classList.toggle('active', i.dataset.category === activeIssueCategoryFilter));
      renderIssuesList();
    };
  });
}

function renderIssuesHeatmap() {
  // clear dots
  document.querySelectorAll('[id^="icell-"]').forEach(el => el.innerHTML = '');

  const activeOnly = issues.filter(i => i.status !== 'closed');
  activeOnly.forEach(iss => {
    const cell = document.getElementById(`icell-${iss.probability}-${iss.impact.overall}`);
    if (cell) {
      const dot = document.createElement('span');
      dot.className = 'risk-dot';
      dot.title = iss.title;
      cell.appendChild(dot);
    }
  });

  // click handlers — filter issues list by cell
  document.querySelectorAll('#issues-heatmap-grid .heatmap-cell').forEach(cell => {
    cell.onclick = () => {
      const { prob, imp } = cell.dataset;
      const isSame = activeIssueHeatmapCell?.prob === prob && activeIssueHeatmapCell?.imp === imp;
      activeIssueHeatmapCell = isSame ? null : { prob, imp };

      document.querySelectorAll('#issues-heatmap-grid .heatmap-cell').forEach(c => {
        c.classList.remove('selected', 'dimmed');
        if (activeIssueHeatmapCell) {
          c.classList.add(c === cell ? 'selected' : 'dimmed');
        }
      });
      renderIssuesList();
    };
  });
}

function renderIssuesCoverage() {
  const container = document.getElementById('issues-coverage-bars');
  if (!container) return;
  const categories = ['Schedule', 'Budget', 'Scope', 'Resource', 'Technical'];
  container.innerHTML = '';
  categories.forEach(cat => {
    const count = issues.filter(i => i.category === cat).length;
    const pct = issues.length ? Math.round((count / issues.length) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'coverage-item issues-coverage-item';
    item.dataset.category = cat;
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="coverage-header">
        <span class="coverage-name">${cat}</span>
        <span class="coverage-pct">${count} issue${count !== 1 ? 's' : ''}</span>
      </div>
      <div class="coverage-track">
        <div class="coverage-fill" style="width:0%" data-target="${pct}"></div>
      </div>`;
    container.appendChild(item);
  });
  requestAnimationFrame(() => {
    container.querySelectorAll('.coverage-fill').forEach(el => { el.style.width = el.dataset.target + '%'; });
  });
}

// ── Dependencies Coverage ─────────────────────────────────────────────────────
function renderDepsCoverage() {
  const active = dependencies.filter(d => d.status !== 'resolved');

  const renderBars = (containerId, items, groups, labelFn) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    groups.forEach(key => {
      const count = items.filter(d => d[labelFn] === key).length;
      if (!items.length) return;
      const pct = Math.round((count / items.length) * 100);
      const item = document.createElement('div');
      item.className = 'coverage-item deps-coverage-item';
      item.dataset.filter = key;
      item.style.cursor = 'pointer';
      item.innerHTML = `
        <div class="coverage-header">
          <span class="coverage-name">${key}</span>
          <span class="coverage-pct">${count} dep${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="coverage-track">
          <div class="coverage-fill" style="width:0%" data-target="${pct}"></div>
        </div>`;
      item.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        applyDepCoverageFilter(containerId, isActive ? null : key, labelFn);
      });
      container.appendChild(item);
    });
    requestAnimationFrame(() => {
      container.querySelectorAll('.coverage-fill').forEach(el => { el.style.width = el.dataset.target + '%'; });
    });
  };

  renderBars('deps-criticality-bars', active, ['critical','high','medium','low'], 'criticality');
  renderBars('deps-type-bars', active, ['internal','external','technical','vendor'], 'type');
}

let activeDepCriticalityFilter = null;
let activeDepTypeFilter        = null;

// Legacy aliases kept for callers that pass containerId/field
function applyDepCoverageFilter(containerId, value, field) {
  if (field === 'criticality') activeDepCriticalityFilter = value;
  else if (field === 'type')   activeDepTypeFilter        = value;

  ['deps-criticality-bars','deps-type-bars'].forEach(id => {
    const activeVal = id === 'deps-criticality-bars' ? activeDepCriticalityFilter : activeDepTypeFilter;
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('.deps-coverage-item').forEach(item => {
      if (!activeVal) {
        item.classList.remove('active','dimmed');
      } else {
        item.classList.toggle('active', item.dataset.filter === activeVal);
        item.classList.toggle('dimmed', item.dataset.filter !== activeVal);
      }
    });
  });

  renderDependenciesList();
}

// ── Dependencies Summary Bar ──────────────────────────────────────────────────
function renderDepsSummaryBar() {
  const hs      = depsHealth();
  const total   = dependencies.length;
  const blocked = dependencies.filter(d => d.status === 'blocked').length;
  const atRisk  = dependencies.filter(d => d.status === 'at-risk').length;
  const el = document.getElementById('deps-health-score');
  if (el) { el.textContent = total ? hs : '—'; }
  const tot = document.getElementById('deps-total');
  if (tot) tot.textContent = total;
  const blk = document.getElementById('deps-blocked-count');
  if (blk) blk.textContent = blocked;
  const ar = document.getElementById('deps-atrisk-count');
  if (ar) ar.textContent = atRisk;
}

// ── Stakeholders health score ─────────────────────────────────────────────────
function stakeholdersHealth() {
  if (!stakeholders.length) return 100;
  const resistant = stakeholders.filter(s => s.attitude === 'resistant').length;
  const unowned   = stakeholders.filter(s => !s.owner && s.quadrant === 'manage-closely').length;
  const penalty   = (resistant * 15) + (unowned * 5);
  return Math.max(0, 100 - penalty);
}

// ── Stakeholders render ───────────────────────────────────────────────────────
function renderStakeholders(filter = 'all') {
  // matrix chips
  const quadrants = ['manage-closely', 'keep-satisfied', 'keep-informed', 'monitor'];
  quadrants.forEach(q => {
    const el = document.getElementById(`chips-${q}`);
    if (!el) return;
    el.innerHTML = '';
    stakeholders.filter(s => s.quadrant === q).forEach(s => {
      const chip = document.createElement('div');
      chip.className = `matrix-chip attitude-${s.attitude}`;
      chip.textContent = s.name;
      chip.title = `${s.role} — ${s.attitude}`;
      chip.addEventListener('click', () => {
        const card = document.getElementById(`sh-card-${s.id}`);
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('item-highlight'); setTimeout(() => card.classList.remove('item-highlight'), 2000); }
      });
      el.appendChild(chip);
    });
  });

  // summary bar
  const hs        = stakeholdersHealth();
  const resistant = stakeholders.filter(s => s.attitude === 'resistant').length;
  const closely   = stakeholders.filter(s => s.quadrant === 'manage-closely').length;
  const hsEl = document.getElementById('stakeholders-health-score');
  if (hsEl) { hsEl.textContent = hs; hsEl.style.color = hs >= 70 ? 'var(--low)' : hs >= 45 ? 'var(--medium)' : 'var(--high)'; }
  const cntEl = document.getElementById('stakeholders-count');
  if (cntEl) cntEl.textContent = stakeholders.length;
  const resEl = document.getElementById('stakeholders-resistant');
  if (resEl) resEl.textContent = resistant;
  const mcEl = document.getElementById('stakeholders-manage-closely');
  if (mcEl) mcEl.textContent = closely;

  // register
  const container = document.getElementById('stakeholders-list');
  if (!container) return;
  const filtered = filter === 'all' ? stakeholders
    : filter === 'resistant' ? stakeholders.filter(s => s.attitude === 'resistant')
    : stakeholders.filter(s => s.quadrant === filter);

  container.innerHTML = '';
  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'risk-card';
    card.id = `sh-card-${s.id}`;
    const attitudeClass = { supportive: 'low', neutral: 'medium', resistant: 'high' }[s.attitude] || 'medium';
    const quadrantLabel = { 'manage-closely': 'Manage Closely', 'keep-satisfied': 'Keep Satisfied', 'keep-informed': 'Keep Informed', 'monitor': 'Monitor' }[s.quadrant] || s.quadrant;
    card.innerHTML = `
      <div class="risk-card-header risk-card-toggle" data-sh-id="${s.id}">
        <div class="risk-header-left">
          <span class="risk-expand-icon">▶</span>
          <div class="risk-title">${esc(s.name)}</div>
        </div>
        <div class="risk-badges">
          <span class="badge badge-${attitudeClass}">${s.attitude}</span>
          <span class="badge" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-muted)">${esc(quadrantLabel)}</span>
          <input class="owner-input" type="text" placeholder="Owner" value="${esc(s.owner || '')}" data-owner-sh="${s.id}" title="Assign owner" />
          <button class="risk-edit-btn" data-sh-edit="${s.id}" title="Edit stakeholder">✏️ Edit</button>
        </div>
      </div>
      <div class="risk-card-body hidden" id="sh-body-${s.id}">
        <p class="risk-description" style="margin-bottom:8px"><strong>${esc(s.role)}</strong> · Power: ${s.power} · Interest: ${s.interest}</p>
        <div class="sh-actions">
          <strong style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Recommended Actions</strong>
          <ul class="sh-action-list">
            ${(s.actions || []).map(a => `<li>${esc(a)}</li>`).join('')}
          </ul>
        </div>
      </div>`;
    container.appendChild(card);

    // expand/collapse
    card.querySelector('.risk-card-toggle').addEventListener('click', e => {
      if (e.target.closest('.owner-input')) return;
      const body = document.getElementById(`sh-body-${s.id}`);
      const icon = card.querySelector('.risk-expand-icon');
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      if (icon) icon.textContent = open ? '▶' : '▼';
      card.classList.toggle('expanded', !open);
    });

    // owner
    const ownerInput = card.querySelector('.owner-input[data-owner-sh]');
    if (ownerInput) {
      ownerInput.addEventListener('click', e => e.stopPropagation());
      ownerInput.addEventListener('change', () => { s.owner = ownerInput.value.trim(); renderCockpitScores(); });
    }

    // edit button
    const editBtn = card.querySelector('[data-sh-edit]');
    if (editBtn) {
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        const body = document.getElementById(`sh-body-${s.id}`);
        const icon = card.querySelector('.risk-expand-icon');
        if (body && body.classList.contains('hidden')) {
          body.classList.remove('hidden');
          if (icon) icon.textContent = '▼';
          card.classList.add('expanded');
        }
        openEditFormSh(s.id);
      });
    }
  });

  // filter tabs
  document.querySelectorAll('[data-sh-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shFilter === filter);
    btn.onclick = () => renderStakeholders(btn.dataset.shFilter);
  });
}

// ── Edit stakeholder inline ───────────────────────────────────────────────────
function openEditFormSh(shId) {
  const s    = stakeholders.find(x => x.id === shId);
  const body = document.getElementById(`sh-body-${shId}`);
  if (!s || !body) return;

  const existing = body.querySelector('.risk-edit-form');
  if (existing) { existing.remove(); return; }

  const quadrantFor = (power, interest) =>
    power === 'high' && interest === 'high' ? 'manage-closely'
    : power === 'high' && interest === 'low' ? 'keep-satisfied'
    : power === 'low' && interest === 'high' ? 'keep-informed'
    : 'monitor';

  const sel = (id, vals, cur) => vals.map(v => `<option value="${v}" ${cur===v?'selected':''}>${v}</option>`).join('');

  const form = document.createElement('div');
  form.className = 'risk-edit-form';
  form.innerHTML = `
    <div class="form-group">
      <label class="budget-label">Name / Role</label>
      <input type="text" class="edit-sh-name" value="${s.name}" />
    </div>
    <div class="form-group">
      <label class="budget-label">Title / Function</label>
      <input type="text" class="edit-sh-role" value="${s.role}" />
    </div>
    <div class="risk-edit-row">
      <div class="form-group">
        <label class="budget-label">Power</label>
        <select class="edit-sh-power">${sel('',['high','low'],s.power)}</select>
      </div>
      <div class="form-group">
        <label class="budget-label">Interest</label>
        <select class="edit-sh-interest">${sel('',['high','low'],s.interest)}</select>
      </div>
      <div class="form-group">
        <label class="budget-label">Attitude</label>
        <select class="edit-sh-attitude">${sel('',['supportive','neutral','resistant'],s.attitude)}</select>
      </div>
    </div>
    <div class="risk-edit-actions">
      <button class="btn-primary edit-save" style="max-width:120px">Save</button>
      <button class="btn-secondary edit-cancel">Cancel</button>
    </div>`;

  body.appendChild(form);

  form.querySelector('.edit-cancel').addEventListener('click', () => form.remove());
  form.querySelector('.edit-save').addEventListener('click', () => {
    s.name     = form.querySelector('.edit-sh-name').value.trim()    || s.name;
    s.role     = form.querySelector('.edit-sh-role').value.trim()    || s.role;
    s.power    = form.querySelector('.edit-sh-power').value;
    s.interest = form.querySelector('.edit-sh-interest').value;
    s.attitude = form.querySelector('.edit-sh-attitude').value;
    s.quadrant = quadrantFor(s.power, s.interest);
    renderStakeholders();
    renderCockpitScores();
  });
}

// ── Stakeholder Pulse (Cockpit) ───────────────────────────────────────────────
function renderStakeholderPulse() {
  const pulseEl = document.getElementById('stakeholder-pulse');
  if (!pulseEl || !stakeholders.length) { pulseEl?.classList.add('hidden'); return; }

  const quadrantCounts = {
    'manage-closely': stakeholders.filter(s => s.quadrant === 'manage-closely').length,
    'keep-satisfied': stakeholders.filter(s => s.quadrant === 'keep-satisfied').length,
    'keep-informed':  stakeholders.filter(s => s.quadrant === 'keep-informed').length,
    'monitor':        stakeholders.filter(s => s.quadrant === 'monitor').length,
  };
  const resistant = stakeholders.filter(s => s.attitude === 'resistant').length;
  const unowned   = stakeholders.filter(s => !s.owner && s.quadrant === 'manage-closely').length;

  const quadrantsEl = document.getElementById('pulse-quadrants');
  if (quadrantsEl) {
    quadrantsEl.innerHTML = `
      <div class="pulse-quadrant-grid">
        <div class="pq-cell"><span class="pq-label">Manage Closely</span><span class="pq-val">${quadrantCounts['manage-closely']}</span></div>
        <div class="pq-cell"><span class="pq-label">Keep Satisfied</span><span class="pq-val">${quadrantCounts['keep-satisfied']}</span></div>
        <div class="pq-cell"><span class="pq-label">Keep Informed</span><span class="pq-val">${quadrantCounts['keep-informed']}</span></div>
        <div class="pq-cell"><span class="pq-label">Monitor</span><span class="pq-val">${quadrantCounts['monitor']}</span></div>
      </div>`;
  }

  const alertsEl = document.getElementById('pulse-alerts');
  if (alertsEl) {
    const alerts = [];
    if (resistant > 0) alerts.push(`${resistant} resistant`);
    if (unowned > 0)   alerts.push(`${unowned} unowned in Manage Closely`);
    if (alerts.length) {
      alertsEl.textContent = '⚠ ' + alerts.join(' · ');
      alertsEl.classList.remove('hidden');
    } else {
      alertsEl.classList.add('hidden');
    }
  }

  pulseEl.classList.remove('hidden');
}

// ── Project Outlook (Cockpit) ─────────────────────────────────────────────────
function renderProjectOutlook() {
  const el = document.getElementById('project-outlook');
  if (!el || !scenarios) { el?.classList.add('hidden'); return; }

  const rows = document.getElementById('outlook-rows');
  if (!rows) return;

  const defs = [
    { key: 'best',     label: 'Best',     icon: '●', cls: 'outlook-best' },
    { key: 'realistic',label: 'Realistic',icon: '●', cls: 'outlook-realistic' },
    { key: 'worst',    label: 'Worst',    cls: 'outlook-worst',    icon: '●' },
  ];

  rows.innerHTML = defs.map(({ key, label, icon, cls }) => {
    const s = scenarios[key];
    if (!s) return '';
    const tw  = s.timeline_delta_weeks;
    const cp  = s.cost_delta_pct;
    const twStr = tw === 0 ? 'on schedule' : tw > 0 ? `+${tw}w` : `${tw}w`;
    const cpStr = cp === 0 ? 'on budget'   : cp > 0 ? `+${cp}%` : `${cp}%`;
    const isCurrent = key === 'realistic';
    return `
      <div class="outlook-row ${cls}">
        <span class="outlook-icon">${icon}</span>
        <span class="outlook-label">${label}</span>
        <span class="outlook-metric">${twStr}</span>
        <span class="outlook-metric">${cpStr} cost</span>
        <span class="outlook-prob">${s.probability}% likely${isCurrent ? ' ← current' : ''}</span>
      </div>`;
  }).join('');

  el.classList.remove('hidden');
}

// ── Scenarios render ──────────────────────────────────────────────────────────
function renderScenarios(data) {
  scenarios = data;
  const grid = document.getElementById('scenarios-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const defs = [
    { key: 'best',      label: 'Best Case',  cls: 'best' },
    { key: 'realistic', label: 'Realistic',  cls: 'realistic' },
    { key: 'worst',     label: 'Worst Case', cls: 'worst' },
  ];

  defs.forEach(({ key, label, cls }) => {
    const s = data[key];
    if (!s) return;
    const tw  = s.timeline_delta_weeks;
    const cp  = s.cost_delta_pct;
    const twStr = tw === 0 ? 'On schedule' : tw > 0 ? `+${tw} weeks` : `${Math.abs(tw)} weeks ahead`;
    const cpStr = cp === 0 ? 'On budget'   : cp > 0 ? `+${cp}% over budget` : `${Math.abs(cp)}% under budget`;
    const twClass = tw <= 0 ? 'positive' : tw <= 4 ? 'neutral' : 'negative';
    const cpClass = cp <= 0 ? 'positive' : cp <= 10 ? 'neutral' : 'negative';

    const card = document.createElement('div');
    card.className = `scenario-card ${cls}`;
    card.innerHTML = `
      <div class="scenario-header">
        <span class="scenario-name">${label}</span>
        <span class="scenario-prob">${s.probability}% likely</span>
      </div>
      <p class="scenario-summary">${esc(s.narrative)}</p>
      <div class="scenario-metrics">
        <div class="scenario-metric">
          <span class="metric-label">Timeline</span>
          <span class="metric-val ${twClass}">${twStr}</span>
        </div>
        <div class="scenario-metric">
          <span class="metric-label">Cost</span>
          <span class="metric-val ${cpClass}">${cpStr}</span>
        </div>
      </div>
      ${s.triggers?.length ? `
      <div class="scenario-triggers">
        <strong class="triggers-label">Key triggers</strong>
        <ul>${s.triggers.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>` : ''}`;
    grid.appendChild(card);
  });

  // Pro: comparison table
  renderScenariosComparisonTable(data);
  renderScenariosKeyMitigations(data);
  renderScenariosSimulator();
  renderProjectOutlook();
  renderCockpitScores();
}

function renderScenariosComparisonTable(data) {
  const el = document.getElementById('scenarios-table');
  if (!el) return;
  const rows = [
    { label: 'Probability', fn: s => `${s.probability}%` },
    { label: 'Timeline',    fn: s => { const tw = s.timeline_delta_weeks; return tw === 0 ? 'On schedule' : tw > 0 ? `+${tw} weeks` : `${Math.abs(tw)} weeks ahead`; } },
    { label: 'Cost',        fn: s => { const cp = s.cost_delta_pct; return cp === 0 ? 'On budget' : cp > 0 ? `+${cp}%` : `${Math.abs(cp)}% under`; } },
  ];
  el.innerHTML = `
    <thead><tr><th></th><th>Best</th><th>Realistic</th><th>Worst</th></tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td class="sc-table-label">${r.label}</td>
          <td class="sc-val best">${r.fn(data.best)}</td>
          <td class="sc-val realistic">${r.fn(data.realistic)}</td>
          <td class="sc-val worst">${r.fn(data.worst)}</td>
        </tr>`).join('')}
    </tbody>`;
}

function renderScenariosKeyMitigations(data) {
  const el = document.getElementById('scenarios-key-mitigations');
  if (!el || !risks.length) return;
  const ids = [...new Set([
    ...(data.best?.key_mitigation_ids || []),
    ...(data.realistic?.key_mitigation_ids || []),
  ])];
  if (!ids.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No scenario-critical risks identified.</p>'; return; }
  el.innerHTML = ids.map(id => {
    const r = risks.find(x => x.id === id);
    if (!r) return '';
    return `<div class="action-row" data-module="risks" data-item-id="risk-card-${id}" style="cursor:pointer">
      <span style="color:var(--accent)">⚡</span>
      <span class="action-text">${esc(r.title)}</span>
      <span class="quickwin-cta">Go →</span>
    </div>`;
  }).join('');
}

function renderScenariosSimulator() {
  if (!scenarios?.realistic || !scenarios?.best || !scenarios?.worst) return;
  const container = document.getElementById('scenarios-simulator-pro');
  if (!container || container.classList.contains('hidden')) return;

  const sc = scenarios;
  const mitCount = Object.keys(activeMitigations).length;

  // Calculate total score_delta from active mitigations
  const totalDelta = Object.entries(activeMitigations).reduce((sum, [riskId, mitIdx]) => {
    const r = risks.find(x => x.id === Number(riskId));
    const delta = r?.mitigations?.[mitIdx]?.score_delta ?? 0;
    return sum + Math.abs(delta);
  }, 0);

  // Risk reduction ratio: max possible delta across all risks
  const maxDelta = risks.reduce((sum, r) => {
    const best = r.mitigations.length
      ? Math.min(...r.mitigations.map(m => m.score_delta))
      : 0;
    return sum + Math.abs(best);
  }, 0);

  const reductionRatio = maxDelta > 0 ? Math.min(totalDelta / maxDelta, 1) : 0;

  // Interpolate between realistic and best based on reduction ratio
  const twRange = sc.realistic.timeline_delta_weeks - sc.best.timeline_delta_weeks;
  const cpRange = sc.realistic.cost_delta_pct - sc.best.cost_delta_pct;
  const adjTw = Math.round(sc.realistic.timeline_delta_weeks - twRange * reductionRatio);
  const adjCp = Math.round(sc.realistic.cost_delta_pct - cpRange * reductionRatio);

  const fmtTw = w => w === 0 ? 'On schedule' : w > 0 ? `+${w}w` : `${w}w`;
  const fmtCp = p => p === 0 ? 'On budget' : p > 0 ? `+${p}% cost` : `${Math.abs(p)}% under budget`;
  const twClass = adjTw <= 0 ? 'positive' : adjTw <= sc.realistic.timeline_delta_weeks / 2 ? 'neutral' : 'negative';
  const cpClass = adjCp <= 0 ? 'positive' : adjCp <= sc.realistic.cost_delta_pct / 2 ? 'neutral' : 'negative';

  // Progress bar: Worst=left(0%) Best=right(100%)
  // Higher adjTw = worse = more left; lower adjTw = better = more right
  const worstTw = sc.worst.timeline_delta_weeks;
  const bestTw  = sc.best.timeline_delta_weeks;
  const totalRange = worstTw - bestTw; // always positive (worst > best)
  const baselinePct         = totalRange > 0 ? Math.round(100 - (sc.realistic.timeline_delta_weeks - bestTw) / totalRange * 100) : 50;
  const projectedPct        = totalRange > 0 ? Math.round(100 - (adjTw - bestTw) / totalRange * 100) : 50;
  const projectedPctClamped = Math.max(0, Math.min(100, projectedPct));

  // Motivational message
  let message = '';
  if (mitCount === 0) {
    message = `<span class="sim-nudge">Apply mitigations in the <strong>Risks tab</strong> to shift your forecast toward the best case.</span>`;
  } else if (reductionRatio < 0.3) {
    message = `<span class="sim-nudge sim-nudge-progress">Good start — ${mitCount} mitigation${mitCount > 1 ? 's' : ''} active. Keep going to move closer to the best case.</span>`;
  } else if (reductionRatio < 0.7) {
    message = `<span class="sim-nudge sim-nudge-good">Solid progress — you've reduced exposure significantly. A few more mitigations could push you into best-case territory.</span>`;
  } else {
    message = `<span class="sim-nudge sim-nudge-great">Excellent — your mitigation plan is pushing the project toward the best case scenario.</span>`;
  }

  container.querySelector('.simulator-content')?.remove();
  const div = document.createElement('div');
  div.className = 'simulator-content';
  div.innerHTML = `
    <div class="sim-track-wrap">
      <div class="sim-track-labels">
        <span class="sim-track-label-worst">Worst<br><small>${fmtTw(sc.worst.timeline_delta_weeks)}</small></span>
        <span class="sim-track-label-best">Best<br><small>${fmtTw(sc.best.timeline_delta_weeks)}</small></span>
      </div>
      <div class="sim-track">
        <div class="sim-track-bar"></div>
        <div class="sim-marker sim-marker-baseline" style="left:${baselinePct}%" title="Realistic baseline">
          <div class="sim-marker-dot sim-marker-dot-baseline"></div>
          <div class="sim-marker-label">Baseline</div>
        </div>
        ${mitCount > 0 ? `
        <div class="sim-marker sim-marker-projected" style="left:${projectedPctClamped}%" title="With active mitigations">
          <div class="sim-marker-dot sim-marker-dot-projected"></div>
          <div class="sim-marker-label sim-marker-label-projected">Now</div>
        </div>` : ''}
      </div>
    </div>

    ${mitCount > 0 ? `
    <div class="sim-values-row">
      <div class="sim-value-block">
        <span class="sim-label">Realistic (baseline)</span>
        <span class="sim-score">${fmtTw(sc.realistic.timeline_delta_weeks)} · ${fmtCp(sc.realistic.cost_delta_pct)}</span>
      </div>
      <div class="sim-arrow sim-arrow-active">→</div>
      <div class="sim-value-block">
        <span class="sim-label">With ${mitCount} mitigation${mitCount !== 1 ? 's' : ''}</span>
        <span class="sim-score sim-score-improved ${twClass}">${fmtTw(adjTw)} · ${fmtCp(adjCp)}</span>
        <span class="sim-gain">${adjTw < sc.realistic.timeline_delta_weeks ? `↓ ${sc.realistic.timeline_delta_weeks - adjTw}w saved` : ''}${adjTw < sc.realistic.timeline_delta_weeks && adjCp < sc.realistic.cost_delta_pct ? ' · ' : ''}${adjCp < sc.realistic.cost_delta_pct ? `↓ ${sc.realistic.cost_delta_pct - adjCp}% cost saved` : ''}</span>
      </div>
    </div>` : `
    <div class="sim-values-row">
      <div class="sim-value-block">
        <span class="sim-label">Realistic (baseline)</span>
        <span class="sim-score">${fmtTw(sc.realistic.timeline_delta_weeks)} · ${fmtCp(sc.realistic.cost_delta_pct)}</span>
      </div>
    </div>`}

    <div class="sim-message">${message}</div>

    ${mitCount === 0 ? `<button class="btn-secondary sim-go-risks sim-link" style="margin-top:4px;max-width:180px" data-module="risks">Go to Risk Register →</button>` : ''}
  `;
  container.appendChild(div);
}

// ── Add Stakeholder (Pro) ─────────────────────────────────────────────────────
function setupAddStakeholder() {
  const saveBtn   = document.getElementById('save-sh-btn');
  const cancelBtn = document.getElementById('cancel-sh-btn');
  if (!saveBtn) return;

  cancelBtn?.addEventListener('click', () => {
    document.getElementById('new-sh-name').value = '';
    document.getElementById('new-sh-role').value = '';
  });

  saveBtn.addEventListener('click', () => {
    const name = document.getElementById('new-sh-name')?.value.trim();
    if (!name) { alert('Name is required.'); return; }
    const power    = document.getElementById('new-sh-power')?.value || 'high';
    const interest = document.getElementById('new-sh-interest')?.value || 'high';
    const attitude = document.getElementById('new-sh-attitude')?.value || 'neutral';
    const role     = document.getElementById('new-sh-role')?.value.trim() || '';
    const quadrant = power === 'high' && interest === 'high' ? 'manage-closely'
                   : power === 'high' && interest === 'low'  ? 'keep-satisfied'
                   : power === 'low'  && interest === 'high' ? 'keep-informed'
                   : 'monitor';
    const newId = Math.max(...stakeholders.map(s => s.id), 0) + 1;
    stakeholders.push({ id: newId, name, role, power, interest, quadrant, attitude, actions: [] });
    renderStakeholders();
    renderCockpitScores();
    document.getElementById('new-sh-name').value = '';
    document.getElementById('new-sh-role').value = '';
  });
}

// ── Dependencies Render ───────────────────────────────────────────────────────
function renderDependenciesList() {
  const container = document.getElementById('deps-list');
  if (!container) return;
  container.innerHTML = '';

  const resolved = dependencies.filter(d => d.status === 'resolved');
  const active   = dependencies.filter(d => d.status !== 'resolved');

  // resolved section
  const resolvedSection = document.getElementById('resolved-deps-section');
  const resolvedList    = document.getElementById('resolved-deps-list');
  const resolvedLabel   = document.getElementById('resolved-deps-label');
  const resolvedToggle  = document.getElementById('resolved-deps-toggle');
  if (resolvedSection) {
    resolvedSection.classList.toggle('hidden', resolved.length === 0);
    const isExpanded = resolvedList && !resolvedList.classList.contains('hidden');
    if (resolvedLabel) resolvedLabel.textContent = `${isExpanded ? '▼' : '▶'} Resolved dependencies (${resolved.length})`;
    if (resolvedList) {
      resolvedList.innerHTML = '';
      resolved.forEach(dep => resolvedList.appendChild(buildDepCard(dep, true)));
      wireDepCards(resolvedList);
    }
    if (resolvedToggle) {
      resolvedToggle.onclick = () => {
        const open = !resolvedList.classList.contains('hidden');
        resolvedList.classList.toggle('hidden', open);
        resolvedLabel.textContent = (open ? '▶' : '▼') + ` Resolved dependencies (${resolved.length})`;
      };
    }
  }

  const filteredDeps = active.filter(dep => {
    if (activeDepFilter !== 'all' && dep.status !== activeDepFilter) return false;
    if (activeDepCriticalityFilter && dep.criticality !== activeDepCriticalityFilter) return false;
    if (activeDepTypeFilter        && dep.type        !== activeDepTypeFilter)        return false;
    return true;
  });
  filteredDeps.forEach(dep => container.appendChild(buildDepCard(dep, false)));
  wireDepCards(container);

  // filter tabs
  document.querySelectorAll('[data-dep-filter]').forEach(btn => {
    btn.onclick = () => {
      activeDepFilter = btn.dataset.depFilter;
      document.querySelectorAll('[data-dep-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderDependenciesList();
    };
  });
}

function buildDepCard(dep, isResolved) {
  const card = document.createElement('div');
  card.className = `dep-card status-${dep.status}${isResolved ? ' dep-resolved' : ''}`;
  card.id = `dep-card-${dep.id}`;
  card.innerHTML = `
    <div class="dep-card-toggle" data-dep-id="${dep.id}" style="cursor:pointer">
      <div class="dep-card-header">
        <div class="risk-header-left">
          <span class="risk-expand-icon">▶</span>
          <span class="dep-card-title">${esc(dep.title)}</span>
        </div>
        <div class="risk-badges">
          <span class="dep-status-badge ${dep.status}">${dep.status.replace('-', ' ')}</span>
          <span class="dep-criticality-badge">${dep.criticality}</span>
          ${!isResolved ? `${dep.neededBy ? `<span class="owner-date-badge ${new Date(dep.neededBy) < new Date() ? 'date-overdue' : ''}">📅 ${dep.neededBy}</span>` : ''}
          <input class="owner-input" type="text" placeholder="Owner" value="${esc(dep.owner || '')}" data-owner-dep="${dep.id}" title="Assign owner" />
          <button class="btn-close-item" data-resolve-dep="${dep.id}" title="Mark as resolved">✓ Resolve</button>
          <button class="risk-edit-btn" data-edit-dep="${dep.id}" title="Edit this dependency">✏️ Edit dependency</button>`
          : `<button class="btn-reopen-item" data-reopen-dep="${dep.id}" title="Reopen this dependency">↩ Reopen</button>`}
        </div>
      </div>
      <div class="dep-card-meta">${esc(dep.from)} → ${esc(dep.to)} · ${dep.type}</div>
    </div>
    <div class="dep-card-body hidden" id="dep-body-${dep.id}">
      <p class="risk-description">${esc(dep.description)}</p>
      <div class="dep-mitigation">
        <div class="dep-mitigation-title">Action</div>
        <div class="dep-mitigation-text">${esc(dep.mitigation.title)}</div>
      </div>
      <div class="risk-impact-row" style="margin-top:10px">
        <span class="impact-tag due-date-field">Needed by: <input type="date" class="inline-date-input" data-neededby-dep="${dep.id}" value="${dep.neededBy || ''}" title="Date this dependency must be resolved" /></span>
      </div>
    </div>`;
  return card;
}

function wireDepCards(container) {
  container.querySelectorAll('.dep-card-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      if (e.target.closest('.btn-edit-risk')) return;
      const id = toggle.dataset.depId;
      const body = document.getElementById(`dep-body-${id}`);
      const icon = toggle.querySelector('.risk-expand-icon');
      const card = toggle.closest('.dep-card');
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      if (icon) icon.textContent = open ? '▶' : '▼';
      card.classList.toggle('expanded', !open);
    });
  });

  // owner input
  container.querySelectorAll('.owner-input[data-owner-dep]').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      const dep = dependencies.find(x => x.id === parseInt(input.dataset.ownerDep));
      if (dep) dep.owner = input.value.trim();
    });
  });

  // needed-by date
  container.querySelectorAll('[data-neededby-dep]').forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      const dep = dependencies.find(x => x.id === parseInt(input.dataset.neededbyDep));
      if (dep) {
        dep.neededBy = input.value;
        renderDependenciesList();
      }
    });
  });

  // reopen buttons
  container.querySelectorAll('[data-reopen-dep]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dep = dependencies.find(x => x.id === parseInt(btn.dataset.reopenDep));
      if (dep) { dep.status = 'at-risk'; }
      renderDependenciesList();
      renderDepsCoverage();
      document.getElementById('deps-health-score').textContent = depsHealth();
      renderCockpitScores();
      renderQuickWins();
    });
  });

  container.querySelectorAll('[data-resolve-dep]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dep = dependencies.find(x => x.id === parseInt(btn.dataset.resolveDep));
      if (dep) { dep.status = 'resolved'; }
      renderDependenciesList();
      renderDepsCoverage();
      document.getElementById('deps-health-score').textContent = depsHealth();
      renderCockpitScores();
      renderQuickWins();
    });
  });

  container.querySelectorAll('.risk-edit-btn[data-edit-dep]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.editDep);
      const body = document.getElementById(`dep-body-${id}`);
      if (body && body.classList.contains('hidden')) body.classList.remove('hidden');
      const icon = btn.closest('.dep-card').querySelector('.risk-expand-icon');
      if (icon) icon.textContent = '▼';
      btn.closest('.dep-card').classList.add('expanded');
      openEditDep(id);
    });
  });
}

// ── Edit Issue inline ─────────────────────────────────────────────────────────
function openEditIssue(id) {
  const iss  = issues.find(x => x.id === id);
  const body = document.getElementById(`issue-body-${id}`);
  if (!iss || !body) return;

  const existing = body.querySelector('.risk-edit-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'risk-edit-form';
  form.innerHTML = `
    <div class="form-group">
      <label class="budget-label">Title</label>
      <input type="text" class="edit-title" value="${iss.title}" />
    </div>
    <div class="form-group">
      <label class="budget-label">Description</label>
      <textarea class="edit-desc" rows="2">${iss.description}</textarea>
    </div>
    <div class="risk-edit-row">
      <div class="form-group">
        <label class="budget-label">Status</label>
        <select class="edit-status">
          ${['open','in-progress','escalated','closed'].map(v => `<option value="${v}" ${iss.status===v?'selected':''}>${v.replace('-',' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="budget-label">Probability</label>
        <select class="edit-prob">
          ${['low','medium','high'].map(v => `<option value="${v}" ${iss.probability===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="budget-label">Impact</label>
        <select class="edit-impact">
          ${['low','medium','high'].map(v => `<option value="${v}" ${iss.impact.overall===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="risk-edit-actions">
      <button class="btn-primary edit-save" style="max-width:120px">Save</button>
      <button class="btn-secondary edit-cancel">Cancel</button>
    </div>`;

  body.appendChild(form);
  form.querySelector('.edit-cancel').addEventListener('click', () => form.remove());
  form.querySelector('.edit-save').addEventListener('click', () => {
    iss.title       = form.querySelector('.edit-title').value.trim() || iss.title;
    iss.description = form.querySelector('.edit-desc').value.trim() || iss.description;
    iss.status      = form.querySelector('.edit-status').value;
    iss.probability = form.querySelector('.edit-prob').value;
    iss.impact.overall = form.querySelector('.edit-impact').value;
    renderIssuesList();
    renderIssuesHeatmap();
    renderIssuesCoverage();
    document.getElementById('issues-health-score').textContent = issuesHealth();
    renderCockpitScores();
    renderQuickWins();
  });
}

// ── Edit Dependency inline ────────────────────────────────────────────────────
function openEditDep(id) {
  const dep  = dependencies.find(x => x.id === id);
  const body = document.getElementById(`dep-body-${id}`);
  if (!dep || !body) return;

  const existing = body.querySelector('.risk-edit-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'risk-edit-form';
  form.innerHTML = `
    <div class="form-group">
      <label class="budget-label">Title</label>
      <input type="text" class="edit-title" value="${dep.title}" />
    </div>
    <div class="form-group">
      <label class="budget-label">Description</label>
      <textarea class="edit-desc" rows="2">${dep.description}</textarea>
    </div>
    <div class="risk-edit-row">
      <div class="form-group">
        <label class="budget-label">Status</label>
        <select class="edit-status">
          ${['on-track','at-risk','blocked','resolved'].map(v => `<option value="${v}" ${dep.status===v?'selected':''}>${v.replace('-',' ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="budget-label">Criticality</label>
        <select class="edit-criticality">
          ${['low','medium','high','critical'].map(v => `<option value="${v}" ${dep.criticality===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="risk-edit-actions">
      <button class="btn-primary edit-save" style="max-width:120px">Save</button>
      <button class="btn-secondary edit-cancel">Cancel</button>
    </div>`;

  body.appendChild(form);
  form.querySelector('.edit-cancel').addEventListener('click', () => form.remove());
  form.querySelector('.edit-save').addEventListener('click', () => {
    dep.title       = form.querySelector('.edit-title').value.trim() || dep.title;
    dep.description = form.querySelector('.edit-desc').value.trim() || dep.description;
    dep.status      = form.querySelector('.edit-status').value;
    dep.criticality = form.querySelector('.edit-criticality').value;
    renderDependenciesList();
    renderDepsCoverage();
    document.getElementById('deps-health-score').textContent = depsHealth();
    renderCockpitScores();
    renderQuickWins();
  });
}

// ── Add Issue (Pro) ───────────────────────────────────────────────────────────
function setupAddIssue() {
  const saveBtn   = document.getElementById('save-issue-btn');
  const cancelBtn = document.getElementById('cancel-issue-btn');
  if (!saveBtn) return;

  cancelBtn.addEventListener('click', () => {
    document.getElementById('new-issue-title').value = '';
    document.getElementById('new-issue-desc').value  = '';
  });

  saveBtn.addEventListener('click', () => {
    const title = document.getElementById('new-issue-title').value.trim();
    if (!title) { alert('Title is required.'); return; }

    const newId = Math.max(...issues.map(i => i.id), 0) + 1;
    issues.push({
      id: newId, title,
      description: document.getElementById('new-issue-desc').value.trim() || 'Custom issue added by PM.',
      category:    document.getElementById('new-issue-category').value,
      status:      document.getElementById('new-issue-status').value,
      probability: document.getElementById('new-issue-probability').value,
      impact: { overall: document.getElementById('new-issue-impact').value,
                schedule: document.getElementById('new-issue-impact').value,
                cost: document.getElementById('new-issue-impact').value },
      resolution: { title: 'To be defined.', effort: 'medium', effectiveness: 'medium', score_delta: -1 }
    });

    renderIssuesList();
    renderIssuesHeatmap();
    renderIssuesCoverage();
    document.getElementById('issues-health-score').textContent = issuesHealth();
    renderCockpitScores();
    document.getElementById('new-issue-title').value = '';
    document.getElementById('new-issue-desc').value  = '';
  });
}

// ── Add Dependency (Pro) ──────────────────────────────────────────────────────
function setupAddDep() {
  const saveBtn   = document.getElementById('save-dep-btn');
  const cancelBtn = document.getElementById('cancel-dep-btn');
  if (!saveBtn) return;

  cancelBtn.addEventListener('click', () => {
    document.getElementById('new-dep-title').value = '';
    document.getElementById('new-dep-desc').value  = '';
    document.getElementById('new-dep-from').value  = '';
    document.getElementById('new-dep-to').value    = '';
  });

  saveBtn.addEventListener('click', () => {
    const title = document.getElementById('new-dep-title').value.trim();
    if (!title) { alert('Title is required.'); return; }

    const newId = Math.max(...dependencies.map(d => d.id), 0) + 1;
    dependencies.push({
      id: newId, title,
      description:  document.getElementById('new-dep-desc').value.trim() || 'Custom dependency added by PM.',
      type:         document.getElementById('new-dep-type').value,
      from:         document.getElementById('new-dep-from').value.trim() || 'TBD',
      to:           document.getElementById('new-dep-to').value.trim() || 'Project Team',
      criticality:  document.getElementById('new-dep-criticality').value,
      status:       document.getElementById('new-dep-status').value,
      mitigation:   { title: 'To be defined.', effort: 'low', score_delta: -1 }
    });

    renderDependenciesList();
    renderDepsCoverage();
    document.getElementById('deps-health-score').textContent = depsHealth();
    renderCockpitScores();
    document.getElementById('new-dep-title').value = '';
    document.getElementById('new-dep-desc').value  = '';
    document.getElementById('new-dep-from').value  = '';
    document.getElementById('new-dep-to').value    = '';
  });
}

// ── Dev mode toggle (localhost only) ─────────────────────────────────────────
const devmodeCheckbox = document.getElementById('devmode-checkbox');
const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
if (devmodeCheckbox) {
  if (!isLocalhost) {
    devmodeCheckbox.closest('.devmode-toggle')?.remove();
  } else {
    devmodeCheckbox.addEventListener('change', () => { DEV_MODE = devmodeCheckbox.checked; });
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.getElementById('readiness-incomplete-cta')?.addEventListener('click', () => {
  if (currentTier === 'pro') {
    switchTab('full-assessment');
  } else {
    // Free: go to Full Assessment tab to show the upgrade teaser
    switchTab('full-assessment');
  }
});

document.getElementById('btn-optimize-nudge')?.addEventListener('click', () => {
  switchTab('risks');
  setTimeout(() => {
    const optimizer = document.getElementById('anchor-optimizer');
    if (!optimizer) return;
    const headerH = document.querySelector('header')?.offsetHeight || 0;
    const top = optimizer.getBoundingClientRect().top + window.scrollY - headerH - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }, 60);
});

startTaglineRotation();

// ── Theme toggle ─────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('pm-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeButton(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pm-theme', next);
  updateThemeButton(next);
});

function updateThemeButton(theme) {
  themeToggle.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    applyAllFilters();
    updateSummaryForFilter();
    updateActiveFiltersBar();
  });
});

function clearAllFilters() {
  activeCategoryFilter = null;
  activeHeatmapCell = null;
  document.querySelectorAll('.heatmap-cell').forEach(c => c.classList.remove('selected', 'dimmed'));
  document.querySelectorAll('.coverage-item').forEach(c => c.classList.remove('active', 'dimmed'));
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
  document.querySelectorAll('.risk-dot').forEach(d => d.style.opacity = '0.9');
  updateCoverageBarsForFilter();
  applyAllFilters();
  updateSummaryForFilter();
  updateActiveFiltersBar();
}

// ── Active filters bar ────────────────────────────────────────────────────────
function updateActiveFiltersBar() {
  const bar = document.getElementById('active-filters');
  bar.innerHTML = '';

  const activeTab = document.querySelector('.filter-tab.active');
  const severityFilter = activeTab ? activeTab.dataset.filter : 'all';

  const chips = [];
  if (severityFilter !== 'all') chips.push({
    label: `Severity: ${severityFilter}`,
    clear: () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
      applyAllFilters();
      updateSummaryForFilter();
      updateActiveFiltersBar();
    }
  });
  if (activeCategoryFilter) chips.push({ label: `Category: ${activeCategoryFilter}`, clear: () => applyCategoryFilter(null) });
  if (activeHeatmapCell)    chips.push({ label: `Heatmap: ${activeHeatmapCell.prob} prob / ${activeHeatmapCell.imp} impact`, clear: () => applyHeatmapFilter(activeHeatmapCell.prob, activeHeatmapCell.imp) });

  if (!chips.length) { bar.classList.add('hidden'); return; }

  bar.classList.remove('hidden');
  const label = document.createElement('span');
  label.className = 'active-filters-label';
  label.textContent = 'Applied filters:';
  bar.appendChild(label);

  chips.forEach(({ label: text, clear }) => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `${text} <span class="filter-chip-x">×</span>`;
    chip.addEventListener('click', clear);
    bar.appendChild(chip);
  });
}

// ── Heatmap cell filter ───────────────────────────────────────────────────────
let activeHeatmapCell = null; // { prob, imp }

function applyHeatmapFilter(prob, imp) {
  const isSame = activeHeatmapCell && activeHeatmapCell.prob === prob && activeHeatmapCell.imp === imp;
  activeHeatmapCell = isSame ? null : { prob, imp };

  document.querySelectorAll('.heatmap-cell').forEach(cell => {
    if (!activeHeatmapCell) {
      cell.classList.remove('selected', 'dimmed');
    } else if (cell.dataset.prob === activeHeatmapCell.prob && cell.dataset.imp === activeHeatmapCell.imp) {
      cell.classList.add('selected');
      cell.classList.remove('dimmed');
    } else {
      cell.classList.add('dimmed');
      cell.classList.remove('selected');
    }
  });

  applyAllFilters();
  updateCoverageBarsForFilter();
  updateSummaryForFilter();
  updateActiveFiltersBar();
}

function updateCoverageBarsForFilter() {
  const filtered = activeHeatmapCell
    ? risks.filter(r => r.probability === activeHeatmapCell.prob && r.impact.overall === activeHeatmapCell.imp)
    : risks;

  const categories = ['Technical', 'Resources', 'External', 'Regulatory', 'Financial'];
  const container = document.getElementById('coverage-bars');
  if (!container) return;

  categories.forEach(cat => {
    const item = container.querySelector(`.coverage-item[data-category="${cat}"]`);
    if (!item) return;
    const count = filtered.filter(r => r.category === cat).length;
    const pct = filtered.length ? Math.min(100, Math.round((count / filtered.length) * 100 * 2.5)) : 0;
    const countEl = item.querySelector('.coverage-pct');
    const fillEl  = item.querySelector('.coverage-fill');
    if (countEl) countEl.textContent = `${count} risk${count !== 1 ? 's' : ''}`;
    if (fillEl)  fillEl.style.width = pct + '%';
  });
}

function applyAllFilters() {
  const activeTab = document.querySelector('.filter-tab.active');
  const severityFilter = activeTab ? activeTab.dataset.filter : 'all';
  let visibleCount = 0;

  document.querySelectorAll('.risk-card').forEach(card => {
    const r = risks.find(x => x.id === parseInt(card.dataset.id));
    if (!r) return;

    const matchesSev = severityFilter === 'all' || card.dataset.severity === severityFilter;
    const matchesCat = !activeCategoryFilter || card.dataset.category === activeCategoryFilter;
    const matchesCell = !activeHeatmapCell ||
      (r.probability === activeHeatmapCell.prob && r.impact.overall === activeHeatmapCell.imp);
    const show = matchesSev && matchesCat && matchesCell;
    card.classList.toggle('hidden', !show);
    if (show) visibleCount++;
  });

  // empty state
  const existing = document.getElementById('risk-list-empty');
  if (existing) existing.remove();
  if (visibleCount === 0) {
    const empty = document.createElement('div');
    empty.id = 'risk-list-empty';
    empty.className = 'risk-list-empty';
    empty.innerHTML = `
      <div class="empty-icon">⚠</div>
      <p>No risks match the active filters.</p>
      <button class="btn-secondary" onclick="clearAllFilters()">Clear filters</button>`;
    document.getElementById('risk-list').after(empty);
  }

  // dim heatmap dots not in selected cell
  document.querySelectorAll('.risk-dot').forEach(dot => {
    const r = risks.find(x => x.id === parseInt(dot.dataset.id));
    if (!r) return;
    const matchesCat  = !activeCategoryFilter || r.category === activeCategoryFilter;
    const matchesCell = !activeHeatmapCell ||
      (r.probability === activeHeatmapCell.prob && r.impact.overall === activeHeatmapCell.imp);
    dot.style.opacity = (matchesCat && matchesCell) ? '0.9' : '0.15';
  });
}

// ── Coverage filter ───────────────────────────────────────────────────────────
let activeCategoryFilter = null;

function applyCategoryFilter(category) {
  activeCategoryFilter = category;

  document.querySelectorAll('.coverage-item').forEach(el => {
    if (!category) {
      el.classList.remove('active', 'dimmed');
    } else if (el.dataset.category === category) {
      el.classList.add('active');
      el.classList.remove('dimmed');
    } else {
      el.classList.add('dimmed');
      el.classList.remove('active');
    }
  });

  applyAllFilters();
  updateSummaryForFilter();
  updateActiveFiltersBar();
}

// ── Generate ──────────────────────────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
  const projectName = document.getElementById('project-name').value.trim();
  const scope       = document.getElementById('scope').value.trim();
  const startDate   = document.getElementById('start-date').value;
  const endDate     = document.getElementById('end-date').value;
  const budget      = document.getElementById('budget').value;
  const currency    = document.getElementById('currency').value;
  const industry    = document.getElementById('industry').value;

  if (!projectName || !scope || !startDate || !endDate || !budget) {
    alert('Please fill in all required fields.');
    return;
  }
  if (new Date(endDate) <= new Date(startDate)) {
    alert('End date must be after start date.');
    return;
  }

  formSection.classList.add('hidden');
  valueStrip?.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  generateBtn.disabled = true;
  activeCategoryFilter = null;
  startLoadingMessages();

  try {
    const assessment = await generateAssessment(scope, startDate, endDate, budget, industry);

    risks        = assessment.risks        || [];
    dependencies = assessment.dependencies || [];
    stakeholders = assessment.stakeholders || [];
    scenarios    = assessment.scenarios    || null;

    projectScope = scope; projectStart = startDate; projectEnd = endDate;
    projectBudget = budget; projectIndustry = industry; projectCurrency = currency;
    pinnedDepIds = [];

    // pin dependencies: all blocked + up to 1 at-risk
    const blockedDeps = dependencies.filter(d => d.status === 'blocked');
    const atRiskDeps  = dependencies.filter(d => d.status === 'at-risk').slice(0, 1);
    pinnedDepIds = [...blockedDeps, ...atRiskDeps].map(d => d.id);

    stopLoadingMessages();
    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('module-nav').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });

    document.getElementById('result-project-name').textContent = projectName;
    document.getElementById('result-project-meta').textContent =
      `${startDate} → ${endDate}  ·  ${currency}${Number(budget).toLocaleString()}${industry ? '  ·  ' + industry : ''}`;

    // Risks module
    renderSummary(risks);
    renderHeatmap(risks);
    renderCoverage(risks);
    renderRiskList(risks);
    document.getElementById('anchor-optimizer').classList.remove('hidden');
    document.getElementById('budget-result').classList.add('hidden');
    document.getElementById('add-risk-section').classList.remove('hidden');

    // Dependencies module
    renderDependenciesList();
    renderDepsCoverage();
    renderDepsSummaryBar();
    document.getElementById('add-dep-section')?.classList.remove('hidden');
    setupAddDep();

    // Stakeholders module
    renderStakeholders();
    document.getElementById('add-stakeholder-section')?.classList.remove('hidden');
    setupAddStakeholder();

    // Scenarios module
    if (scenarios) renderScenarios(scenarios);

    applyTier(currentTier);
    renderOptimizerGuidance(parseFloat(budget) || 0);
    renderCountGuidance();
    setupAddRisk();
    setupExport();

    switchTab('cockpit');
    renderCockpitScores();
    renderPulseBar();

  } catch (err) {
    stopLoadingMessages();
    loadingSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    valueStrip?.classList.remove('hidden');
    generateBtn.disabled = false;
    showError(
      'Could not generate assessment',
      err.message || 'Check your connection and try again.',
      () => generateBtn.click()
    );
  }
});

// ── New assessment ────────────────────────────────────────────────────────────
newAssessmentBtn.addEventListener('click', () => {
  risks = []; dependencies = []; stakeholders = []; scenarios = null;
  pinnedDepIds = [];
  activeCategoryFilter = null;
  activeHeatmapCell = null;
  activeDepCriticalityFilter = null;
  activeDepTypeFilter = null;
  Object.keys(activeMitigations).forEach(k => delete activeMitigations[k]);
  currentPlan = [];
  document.getElementById('anchor-optimizer').classList.add('hidden');
  document.getElementById('budget-result').classList.add('hidden');
  document.getElementById('add-risk-section').classList.add('hidden');
  resultsSection.classList.add('hidden');
  document.getElementById('module-nav').classList.add('hidden');
  formSection.classList.remove('hidden');
  valueStrip?.classList.remove('hidden');
  generateBtn.disabled = false;
  document.getElementById('project-name').value = '';
  document.getElementById('scope').value = '';
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('budget').value = '';
  document.getElementById('industry').value = '';
});
