interface DashboardWebinarResultsProps {
  vendorName: string;
}

type SentimentLevel = "positive" | "mixed" | "negative";

interface WebinarResult {
  id: string;
  title: string;
  heldOn: string;
  registrants: number;
  attendees: number;
  currentCustomerAttendees: number;
  nonCustomerAttendees: number;
  pipelineInfluenced: number;
  demoRequests: number;
  ctaClicks: number;
  sentiment: SentimentLevel;
  topAmaQuestions: string[];
}

const MOCK_WEBINAR_RESULTS: WebinarResult[] = [
  {
    id: "wbr-jan-qna",
    title: "2026 Product Roadmap AMA",
    heldOn: "2026-01-18",
    registrants: 212,
    attendees: 168,
    currentCustomerAttendees: 71,
    nonCustomerAttendees: 97,
    pipelineInfluenced: 182000,
    demoRequests: 27,
    ctaClicks: 61,
    sentiment: "positive",
    topAmaQuestions: [
      "How quickly can multi-store groups onboard?",
      "What integrations are planned for Q2?",
      "Do you support custom role permissions?",
    ],
  },
  {
    id: "wbr-feb-best-practices",
    title: "Dealer Success Playbook: Live Workshop",
    heldOn: "2026-02-07",
    registrants: 174,
    attendees: 131,
    currentCustomerAttendees: 58,
    nonCustomerAttendees: 73,
    pipelineInfluenced: 149500,
    demoRequests: 19,
    ctaClicks: 44,
    sentiment: "mixed",
    topAmaQuestions: [
      "What KPI targets should we benchmark monthly?",
      "How do top teams improve adoption in 30 days?",
      "Can we segment reports by rooftop and brand?",
    ],
  },
  {
    id: "wbr-feb-ai-session",
    title: "AI Workflows for Variable Ops Teams",
    heldOn: "2026-02-21",
    registrants: 238,
    attendees: 196,
    currentCustomerAttendees: 79,
    nonCustomerAttendees: 117,
    pipelineInfluenced: 227000,
    demoRequests: 34,
    ctaClicks: 73,
    sentiment: "positive",
    topAmaQuestions: [
      "How is response quality measured over time?",
      "Can AI summaries map to our sales process stages?",
      "Which use cases show fastest ROI in dealerships?",
    ],
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSentimentClasses(sentiment: SentimentLevel): string {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (sentiment === "negative") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function DashboardWebinarResults({ vendorName }: DashboardWebinarResultsProps): JSX.Element {
  const totalRegistrants = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.registrants, 0);
  const totalAttendees = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.attendees, 0);
  const totalPipeline = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.pipelineInfluenced, 0);
  const totalDemoRequests = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.demoRequests, 0);
  const totalCtaClicks = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.ctaClicks, 0);
  const totalCurrentCustomerAttendees = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.currentCustomerAttendees, 0);
  const totalNonCustomerAttendees = MOCK_WEBINAR_RESULTS.reduce((sum, webinar) => sum + webinar.nonCustomerAttendees, 0);
  const attendanceRate = totalRegistrants > 0 ? Math.round((totalAttendees / totalRegistrants) * 100) : 0;
  const currentCustomerRate = totalAttendees > 0
    ? Math.round((totalCurrentCustomerAttendees / totalAttendees) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Webinar Results</h1>
      <p className="mt-1 text-sm text-slate-500">
        Performance snapshots from {vendorName} webinars and ask-me-anything sessions
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Registrants</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalRegistrants}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Attendees</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalAttendees}</p>
          <p className="mt-1 text-xs text-slate-500">{attendanceRate}% attendance rate</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Customer Mix</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {totalCurrentCustomerAttendees} / {totalNonCustomerAttendees}
          </p>
          <p className="mt-1 text-xs text-slate-500">Current / Non-customer ({currentCustomerRate}% current)</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pipeline Influenced</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Demo Requests</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalDemoRequests}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">CTA Clicks</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalCtaClicks}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {MOCK_WEBINAR_RESULTS.map((webinar) => {
          const sessionAttendanceRate = webinar.registrants > 0
            ? Math.round((webinar.attendees / webinar.registrants) * 100)
            : 0;
          const sessionCurrentCustomerRate = webinar.attendees > 0
            ? Math.round((webinar.currentCustomerAttendees / webinar.attendees) * 100)
            : 0;

          return (
            <article key={webinar.id} className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">{webinar.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(webinar.heldOn)}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getSentimentClasses(webinar.sentiment)}`}>
                  {webinar.sentiment} sentiment
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Registrants</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{webinar.registrants}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Attendees</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {webinar.attendees} <span className="text-sm font-normal text-slate-500">({sessionAttendanceRate}%)</span>
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Customer / Non-customer</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {webinar.currentCustomerAttendees} / {webinar.nonCustomerAttendees}
                  </p>
                  <p className="text-xs text-slate-500">{sessionCurrentCustomerRate}% current customers</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Pipeline Influenced</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600">{formatCurrency(webinar.pipelineInfluenced)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Demo Requests / CTA Clicks</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {webinar.demoRequests} / {webinar.ctaClicks}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-800">Top AMA Questions</h3>
                <ul className="mt-2 space-y-1">
                  {webinar.topAmaQuestions.map((question) => (
                    <li key={question} className="text-sm text-slate-600">
                      - {question}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        This page is currently backed by mock data and is ready to connect to a Supabase source.
      </p>
    </div>
  );
}
