"""Demo seed data in each platform's native raw shape.

Totals reproduce the PRD Q4 table (Oct 1 - Nov 15 2026):
  Google $17k 34 MQL 9 SQL | LinkedIn $21k 76/7 | Billboard $13k 5/2 | Conferences $12k 25/7
LinkedIn carries the planted pattern: cheapest MQL, most expensive SQL.
Webinars use SELF outcome mode (funnel columns in the file itself) for the live add-a-channel demo.
Deterministic: fixed seed, exact integer splits. Run: python seed/generate.py
"""
import csv
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).parent / "csv"
START, END = date(2026, 10, 1), date(2026, 11, 15)
DAYS = [START + timedelta(d) for d in range((END - START).days + 1)]
ACV = 120_000
rng = random.Random(2027)

FIRST = ["Ana", "Ben", "Chen", "Dana", "Eli", "Fatima", "Gus", "Hana", "Ivan", "Jo", "Kai", "Lena", "Mo", "Nia", "Omar", "Priya", "Raj", "Sara", "Tom", "Uma", "Vic", "Wen", "Yara", "Zoe"]
LAST = ["Ng", "Patel", "Kim", "Lopez", "Rossi", "Smith", "Okafor", "Silva", "Cohen", "Ivanova", "Tan", "Berg", "Diaz", "Khan", "Moreau"]
ICP = [("Mercy Health", "Healthcare", 42000), ("Atlas Bank", "Finance", 18000), ("Northwell Care", "Healthcare", 75000),
       ("Granite Capital", "Finance", 9000), ("Summit Insurance", "Finance", 12000), ("Pioneer Medical", "Healthcare", 21000),
       ("Harbor Trust", "Finance", 6500), ("Beacon Health", "Healthcare", 33000)]
NON_ICP = [("Loop Studio", "Media", 40), ("Quill Labs", "Software", 120), ("Brightside Retail", "Retail", 900), ("Nimbus Games", "Gaming", 300)]
SENIOR = ["Director of Data Science", "VP Information Technology", "Chief Data Officer", "Director, AI Platforms", "CIO", "VP Engineering"]
JUNIOR = ["Data Scientist", "ML Engineer", "IT Manager", "Analyst", "Student", "Software Engineer"]


def split(total: int, weights: list[float]) -> list[int]:
    """Integer split of total by weights, exact sum (largest remainder). O(n log n)."""
    raw = [total * w / sum(weights) for w in weights]
    out = [int(r) for r in raw]
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - out[i], reverse=True)[: total - sum(out)]:
        out[i] += 1
    return out


def daily(total: int, days=DAYS) -> list[int]:
    return split(total, [rng.uniform(0.6, 1.4) for _ in days])


def write(name: str, rows: list[dict]) -> None:
    OUT.mkdir(exist_ok=True)
    with open(OUT / f"{name}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"{name}.csv  {len(rows)} rows")


crm: list[dict] = []


def lead(source: str, created: date, mql: bool, sql: bool, **attrs) -> dict:
    """One CRM lead. MQLs are ICP + senior; non-MQLs are off-ICP or junior."""
    company, industry, emp = rng.choice(ICP) if mql else rng.choice(ICP + NON_ICP)
    title = rng.choice(SENIOR) if mql else rng.choice(JUNIOR)
    fn, ln = rng.choice(FIRST), rng.choice(LAST)
    mql_d = min(created + timedelta(rng.randint(0, 2)), END) if mql else None
    sql_d = mql_d + timedelta(rng.randint(3, 9)) if sql else None
    if sql_d and sql_d > END:
        sql_d = END
    row = dict(
        lead_id=f"L{len(crm) + 1:05d}", email=f"{fn}.{ln}.{len(crm) + 1}@{company.split()[0].lower()}.com".lower(),
        first_name=fn, last_name=ln, company=company, industry=industry, employee_count=emp, job_title=title,
        lead_source=source, utm_source="", utm_campaign="", utm_term="", li_creative_id="", event_name="", landing_url="",
        create_date=created.isoformat(), became_mql_date=mql_d.isoformat() if mql_d else "",
        became_sql_date=sql_d.isoformat() if sql_d else "", opp_amount=ACV if sql else "",
        closed_won_date="", lifecycle_stage="opportunity" if sql else ("mql" if mql else "lead"),
    )
    row.update(attrs)
    crm.append(row)
    return row


# ---- Google Ads: daily rows per keyword, cost in micros ----------------------
GOOGLE = [  # campaign, ad_group, keyword, spend_usd, leads, mql, sql
    ("Brand", "Datasaur", "datasaur", 1500, 9, 6, 2),
    ("Data Labeling", "Labeling", "data labeling platform", 4200, 14, 8, 2),
    ("Data Labeling", "Labeling", "text annotation tool", 2600, 9, 4, 1),
    ("LLM Fine-tuning", "Fine-tune", "fine tune llm enterprise", 4100, 12, 7, 2),
    ("Healthcare NLP", "Clinical", "clinical nlp software", 3200, 10, 6, 2),
    ("Healthcare NLP", "Clinical", "medical text labeling", 1400, 6, 3, 0),
]
g_rows = []
for camp, grp, kw, spend, n_leads, mql, sql in GOOGLE:
    for d, cents in zip(DAYS, daily(spend * 100)):
        clicks = max(1, cents // rng.randint(700, 1100))
        g_rows.append(dict(segments_date=d.isoformat(), campaign_name=camp, ad_group_name=grp, keyword_text=kw,
                           match_type=rng.choice(["EXACT", "PHRASE"]), impressions=clicks * rng.randint(18, 30),
                           clicks=clicks, cost_micros=cents * 10_000, conversions=0))
    flags = split(n_leads, [1] * len(DAYS))
    # place conversions on the click rows; CRM carries the utm keys for each form fill
    days_with = [d for d, k in zip(DAYS, flags) for _ in range(k)]
    order = [(i < mql, i < sql) for i in range(n_leads)]
    rng.shuffle(order)
    for d, (m, s) in zip(days_with, order):
        lead("Paid Search", d, m, s, utm_source="google", utm_campaign=camp, utm_term=kw)
        next(r for r in g_rows if r["segments_date"] == d.isoformat() and r["keyword_text"] == kw)["conversions"] += 1
write("google_ads", g_rows)

# ---- LinkedIn Ads: daily rows per creative with audience facets ---------------
LINKEDIN = [  # creative, text, industry, seniority, company_size, spend, leads, mql, sql
    ("Retarget: site visitors", "Your labeling backlog, cleared in a week.", "Healthcare;Finance", "Director+", "1k+", 1800, 9, 6, 1),
    ("Finance, Director+, 5k+ emp", "How banks label 1M documents without a vendor army.", "Finance", "Director+", "5k+", 4200, 16, 10, 2),
    ("Healthcare, VP IT", "HIPAA-ready annotation in your own cloud.", "Healthcare", "VP+", "1k+", 2400, 10, 6, 1),
    ("Thought-leader ad: CEO post", "Why private LLMs beat public APIs for regulated data.", "Healthcare;Finance", "Director+", "1k+", 2900, 13, 8, 1),
    ("Doc ad: AI readiness report", "Download: The 2027 AI readiness report for regulated industries.", "Healthcare;Finance", "Manager+", "500+", 3300, 26, 14, 1),
    ("Conversation ad", "Want a 15-minute look at Foundry?", "Healthcare;Finance", "Manager+", "500+", 4100, 21, 12, 1),
    ("Data science, Manager", "Ship models faster with better labels.", "Healthcare;Finance", "Manager", "1k+", 1300, 20, 12, 0),
    ("IT Manager, 1k-5k emp", "Annotation your IT team can actually govern.", "Healthcare;Finance", "Manager", "1k-5k", 1000, 14, 8, 0),
]
li_rows = []
for i, (name, text, ind, sen, size, spend, n_leads, mql, sql) in enumerate(LINKEDIN):
    cid = f"cr_{9100 + i}"
    leads_by_day = split(n_leads, [1] * len(DAYS))
    for d, cents, k in zip(DAYS, daily(spend * 100), leads_by_day):
        li_rows.append(dict(date=d.isoformat(), campaign_group="FY26 Q4 Foundry", creative_id=cid, creative_name=name,
                            creative_text=text, audience_industry=ind, audience_seniority=sen, audience_company_size=size,
                            impressions=cents // 2, clicks=max(1, cents // 1500), spend_usd=f"{cents / 100:.2f}", lead_form_leads=k))
    order = [(j < mql, j < sql) for j in range(n_leads)]
    rng.shuffle(order)
    days_with = [d for d, k in zip(DAYS, leads_by_day) for _ in range(k)]
    for d, (m, s) in zip(days_with, order):
        lead("LinkedIn Lead Gen", d, m, s, li_creative_id=cid, utm_source="linkedin")
write("linkedin_ads", li_rows)

# ---- Billboards: one row per board per flight, flat cost -----------------------
OOH = [  # board, market, location, start, end, weekly_imps, cost, vanity, leads, mql, sql
    ("BB-SF-101", "San Francisco", "US-101 S at Cesar Chavez", "2026-10-01", "2026-10-28", 410000, 4000, "datasaur.ai/sf", 4, 2, 1),
    ("BB-SF-101", "San Francisco", "US-101 S at Cesar Chavez", "2026-10-29", "2026-11-25", 410000, 4000, "datasaur.ai/sf", 3, 2, 1),
    ("BB-NYC-7A", "New York", "7th Ave and W 33rd St", "2026-10-15", "2026-11-11", 520000, 5000, "datasaur.ai/nyc", 4, 1, 0),
]
ooh_rows = []
for board, mkt, loc, s, e, imps, cost, url, n_leads, mql, sql in OOH:
    s_d, e_d = date.fromisoformat(s), date.fromisoformat(e)
    live = [d for d in DAYS if s_d <= d <= e_d]
    ooh_rows.append(dict(board_id=board, market=mkt, location=loc, format="Bulletin 14x48", flight_start=s, flight_end=e,
                         weekly_impressions=imps, flat_cost_usd=cost, vanity_url=url, qr_code_id=f"QR-{board}",
                         vanity_url_visits=rng.randint(180, 400), qr_scans=rng.randint(20, 60)))
    order = [(j < mql, j < sql) for j in range(n_leads)]
    rng.shuffle(order)
    for (m, sq) in order:
        lead("Billboard", rng.choice(live), m, sq, landing_url=url, utm_source="ooh")
write("ooh_flights", ooh_rows)

# ---- Conferences: one row per event + badge scan list --------------------------
EVENTS = [  # id, name, city, date, booth, sponsor, travel, scans, mql, sql
    ("EV-01", "Healthcare AI Summit", "Boston", "2026-10-08", 3500, 2000, 1500, 180, 15, 4),
    ("EV-02", "CIO Dinner Series", "New York", "2026-10-22", 0, 1500, 500, 12, 6, 2),
    ("EV-03", "Fintech CIO Forum", "Chicago", "2026-11-05", 1500, 800, 700, 90, 4, 1),
]
ev_rows, scan_rows = [], []
for eid, name, city, d, booth, sponsor, travel, scans, mql, sql in EVENTS:
    ev_rows.append(dict(event_id=eid, event_name=name, city=city, event_date=d, booth_cost=booth,
                        sponsorship_cost=sponsor, travel_cost=travel, attendees_est=scans * 6))
    order = [(j < mql, j < sql) for j in range(scans)]
    rng.shuffle(order)
    for (m, s) in order:
        r = lead("Event", date.fromisoformat(d), m, s, event_name=name)
        follow = "meeting_booked" if s else ("replied" if m else rng.choice(["none", "none", "none", "bounced"]))
        scan_rows.append(dict(scan_id=f"S{len(scan_rows) + 1:05d}", event_id=eid, scanned_at=f"{d} {rng.randint(9, 17)}:{rng.randint(0, 59):02d}",
                              email=r["email"], full_name=f"{r['first_name']} {r['last_name']}", company=r["company"],
                              title=r["job_title"], follow_up=follow))
write("events", ev_rows)
write("badge_scans", scan_rows)

write("crm_leads", crm)

# ---- Webinars (SELF mode): the file already carries funnel outcomes ------------
web = []
for d, title, cost, reg, att, mql, sql in [
    ("2026-10-14", "Labeling clinical notes at scale", 1800, 140, 61, 9, 3),
    ("2026-11-04", "Private LLMs for banks", 2200, 170, 74, 11, 4),
]:
    web.append(dict(webinar_date=d, title=title, platform_cost_usd=cost, promo_cost_usd=round(cost * 0.6),
                    registrants=reg, attendees=att, qualified_leads=mql, sales_accepted=sql, opportunities=sql,
                    pipeline_usd=sql * ACV))
write("webinars", web)

for src, ch in [("Paid Search", "google"), ("LinkedIn Lead Gen", "linkedin"), ("Billboard", "ooh"), ("Event", "events")]:
    rows = [r for r in crm if r["lead_source"] == src]
    print(f"  {ch:9s} leads={len(rows):4d} mql={sum(1 for r in rows if r['became_mql_date']):3d} sql={sum(1 for r in rows if r['became_sql_date']):2d}")
