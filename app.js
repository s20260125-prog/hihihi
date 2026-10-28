(() => {
  "use strict";

  // ------------------------------------------------------------
  // Data
  // ------------------------------------------------------------
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);
  const DAY = 86400000;

  const TOOL_META = {
    notion: { name: "Notion", desc: "Docs, wikis & project hubs", projectLabel: "Default database", project: "Launch HQ", workspace: "Northwind HQ", glyph: "N" },
    jira: { name: "Jira", desc: "Engineering issues & sprints", projectLabel: "Default project", project: "ENG · Growth", workspace: "northwind.atlassian.net", glyph: "J" },
    trello: { name: "Trello", desc: "Boards for GTM & operations", projectLabel: "Default board", project: "GTM board", workspace: "Northwind workspace", glyph: "T" },
    slack: { name: "Slack", desc: "Owner notifications & handoffs", projectLabel: "Default channel", project: "#launch-room", workspace: "Northwind HQ", glyph: "S" }
  };

  const PEOPLE = {
    maya: { name: "Maya Chen", initials: "MC", role: "Product lead" },
    priya: { name: "Priya Shah", initials: "PS", role: "Design lead" },
    marcus: { name: "Marcus Lee", initials: "ML", role: "Engineering" },
    sofia: { name: "Sofia Reyes", initials: "SR", role: "Marketing" },
    daniel: { name: "Daniel Kim", initials: "DK", role: "Data" },
    amara: { name: "Amara Okafor", initials: "AO", role: "Customer success" }
  };

  const GUEST_COLORS = [
    { bg: "#dcece4", fg: "#2d5741" }, { bg: "#f6dfc7", fg: "#6e4621" }, { bg: "#dbe2fa", fg: "#344a86" },
    { bg: "#f3d5e3", fg: "#712d49" }, { bg: "#e6dcfa", fg: "#4d347f" }, { bg: "#edf0c9", fg: "#58602a" }
  ];

  const RULE_POOL = {
    legal: { when: "Task mentions “legal” or “copy”", then: "Route to <b>Notion</b> · Launch HQ" },
    lowconf: { when: "Confidence is below 85%", then: "Leave in review for a human" },
    social: { when: "Task mentions “social” or “teaser”", then: "Route to <b>Trello</b> · GTM board" }
  };

  const SAMPLE_TRANSCRIPT = `Maya Chen: Okay, let's lock the Q4 launch. We're still targeting November 4, right?
Priya Shah: Yes, Nov 4. But the pricing page copy still needs legal sign-off. I'll finalize the pricing page copy and send it to legal by Friday.
Marcus Lee: I found a bug in the checkout webhook retry logic. It's a blocker. I'll fix the checkout webhook retry bug by tomorrow and deploy it to staging.
Maya Chen: Great. Sofia, can you post the updated launch timeline in #launch-room by end of day?
Sofia Reyes: Got it.
Maya Chen: We also need customer proof for the case study. Sofia, can you book the Northwind customer interview by next Tuesday?
Sofia Reyes: Yep, on it.
Priya Shah: I'll also prepare the paid social assets for the teaser by Thursday. We can delay the teaser a day if needed.
Maya Chen: Perfect. Launch date stays Nov 4. Paid social can slip to Oct 31. Pricing copy is the gating item.`;

  const state = {
    page: "overview",
    meetings: [],
    activity: [],
    integrations: {
      notion: { connected: true, workspace: "Northwind HQ", project: "Launch HQ" },
      jira: { connected: true, workspace: "northwind.atlassian.net", project: "ENG · Growth" },
      trello: { connected: true, workspace: "Northwind workspace", project: "GTM board" },
      slack: { connected: true, workspace: "Northwind HQ", project: "#launch-room" }
    },
    rules: [
      { id: "urgent", on: true, when: "Priority is Urgent", then: "Route to <b>Jira</b> · ENG · Growth" },
      { id: "legal", on: true, when: "Task mentions “legal” or “copy”", then: "Route to <b>Notion</b> · Launch HQ" },
      { id: "default", on: true, when: "No rule matches", then: "Keep Relay's suggested destination" }
    ],
    meetingFilter: "all",
    actionFilter: { q: "", owner: "all", tool: "all", status: "all" },
    routedTotal: 38,
    hoursSaved: 7.4,
    refs: { notion: 842, jira: 1291, trello: 77 }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const icon = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const esc = (str = "") => String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escAttr = esc;
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const listFormat = arr => arr.length < 3 ? arr.join(" and ") : `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;

  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function addDays(n) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return iso(d); }
  function dateFromISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function fmtDay(s) {
    if (!s) return "No date";
    const date = dateFromISO(s);
    const diff = Math.round((date - TODAY) / DAY);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const fmtLong = d => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isOverdue = a => !!a.due && dateFromISO(a.due) < TODAY && a.status !== "done";

  function personAvatar(key, cls = "") {
    const p = PEOPLE[key] || PEOPLE.maya;
    return `<span class="avatar ${cls} av-${key}" title="${esc(p.name)}">${esc(p.initials)}</span>`;
  }
  function personName(key) { return (PEOPLE[key] || { name: key }).name.split(" ")[0]; }

  function toolIcon(tool, cls = "") {
    const meta = TOOL_META[tool] || TOOL_META.notion;
    let glyph = meta.glyph;
    if (!cls.includes("lg")) {
      if (tool === "notion") glyph = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 17.5v-11l9 11v-11" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      if (tool === "jira") glyph = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 5 10h4v4h6v-4h4l-7-7Z"/><path d="M12 12.7 9.2 15.5 12 18.3l2.8-2.8-2.8-2.8Z" opacity=".55"/></svg>`;
      if (tool === "trello") glyph = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="3.5" width="6.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.3" y="3.5" width="6.2" height="9" rx="1.6" fill="currentColor"/></svg>`;
      if (tool === "slack") glyph = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="6" height="3" rx="1.5" fill="currentColor"/><rect x="13" y="11" width="6" height="3" rx="1.5" fill="currentColor"/><rect x="10" y="5" width="3" height="6" rx="1.5" fill="currentColor"/><rect x="11" y="13" width="3" height="6" rx="1.5" fill="currentColor"/></svg>`;
    }
    return `<span class="tool-ico tool-${tool} ${cls}" title="${esc(meta.name)}" aria-label="${esc(meta.name)}">${glyph}</span>`;
  }

  function sourceMeta(kind) {
    const map = {
      meet: { label: "Google Meet", cls: "meet", icon: "calendar" },
      zoom: { label: "Zoom", cls: "zoom", icon: "mic" },
      fireflies: { label: "Fireflies", cls: "fireflies", icon: "sparkles" },
      upload: { label: "Recording", cls: "other", icon: "upload" },
      other: { label: "Other", cls: "other", icon: "file" }
    };
    return map[kind] || map.other;
  }
  function sourceIcon(kind) {
    const m = sourceMeta(kind);
    return `<span class="source-badge ${m.cls}" title="${m.label}">${icon(m.icon)}</span>`;
  }
  function sourceKindFromName(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("zoom")) return "zoom";
    if (n.includes("firefly") || n.includes("fireflies")) return "fireflies";
    if (n.includes("meet")) return "meet";
    return "other";
  }
  function statusPill(status) {
    if (status === "routed") return `<span class="pill routed">Routed</span>`;
    if (status === "done") return `<span class="pill done">Done</span>`;
    if (status === "processing") return `<span class="pill processing">Processing</span>`;
    return `<span class="pill review">Needs review</span>`;
  }
  function allActions() {
    return state.meetings.flatMap(m => m.actions.map(a => ({ action: a, meeting: m })));
  }

  function refreshPeopleOptions() {
    const sel = $("#ownerFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="all">All owners</option>` + Object.entries(PEOPLE).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("");
    sel.value = [...sel.options].some(o => o.value === current) ? current : "all";
  }

  // ------------------------------------------------------------
  // Seed
  // ------------------------------------------------------------
  function seed() {
    const q4 = [
      { id: "a-q4-1", title: "Finalize the pricing page copy and send it to legal", owner: "priya", due: addDays(3), destination: "notion", priority: "high", confidence: 96, status: "review" },
      { id: "a-q4-2", title: "Fix the checkout webhook retry bug and deploy to staging", owner: "marcus", due: addDays(1), destination: "jira", priority: "urgent", confidence: 98, status: "review" },
      { id: "a-q4-3", title: "Post the updated launch timeline in #launch-room", owner: "sofia", due: addDays(0), destination: "notion", priority: "high", confidence: 93, status: "review" },
      { id: "a-q4-4", title: "Book the Northwind customer interview", owner: "sofia", due: addDays(7), destination: "notion", priority: "medium", confidence: 91, status: "review" },
      { id: "a-q4-5", title: "Prepare paid social assets for the teaser", owner: "priya", due: addDays(4), destination: "trello", priority: "medium", confidence: 90, status: "review" }
    ];
    const pricing = [
      { id: "a-price-1", title: "Turn the pricing test results into a one-page readout", owner: "daniel", due: addDays(1), destination: "notion", priority: "high", confidence: 94, status: "review" },
      { id: "a-price-2", title: "Share the readout with Sales before enablement", owner: "amara", due: addDays(2), destination: "notion", priority: "medium", confidence: 92, status: "review" },
      { id: "a-price-3", title: "Update the experiment tracker with final conversion numbers", owner: "daniel", due: addDays(-1), destination: "notion", priority: "high", confidence: 95, status: "review" }
    ];
    const onboarding = [
      { id: "a-onb-1", title: "Prototype the new workspace picker", owner: "priya", due: addDays(2), destination: "notion", priority: "medium", confidence: 96, status: "routed", routeRef: "NOT-833" },
      { id: "a-onb-2", title: "Instrument step 2 drop-off events", owner: "daniel", due: addDays(5), destination: "jira", priority: "high", confidence: 94, status: "routed", routeRef: "ENG-1187" }
    ];
    const northwind = [
      { id: "a-nw-1", title: "Send the security questionnaire to Northwind", owner: "amara", due: addDays(2), destination: "notion", priority: "high", confidence: 97, status: "routed", routeRef: "NOT-829" },
      { id: "a-nw-2", title: "Schedule the technical deep-dive with their platform team", owner: "maya", due: addDays(6), destination: "trello", priority: "medium", confidence: 92, status: "routed", routeRef: "TRL-71" }
    ];
    const gtm = [
      { id: "a-gtm-1", title: "Refresh the launch FAQ in the enablement hub", owner: "sofia", due: addDays(1), destination: "notion", priority: "medium", confidence: 95, status: "routed", routeRef: "NOT-826" },
      { id: "a-gtm-2", title: "Cut a 20-second teaser from the customer clip", owner: "priya", due: addDays(3), destination: "trello", priority: "high", confidence: 93, status: "routed", routeRef: "TRL-64" },
      { id: "a-gtm-3", title: "Add UTM parameters to the partner newsletter", owner: "sofia", due: addDays(4), destination: "trello", priority: "medium", confidence: 90, status: "routed", routeRef: "TRL-65" }
    ];

    state.meetings = [
      {
        id: "q4-launch", title: "Q4 Launch — Weekly Sync", source: "Google Meet", sourceKind: "meet", when: "Today · 9:30 AM", date: addDays(0), duration: "45 min", status: "review", confidence: 94, participants: ["maya", "priya", "marcus", "sofia"],
        summary: "The team held the Nov 4 launch date and split ownership across five workstreams. Pricing copy and checkout reliability are the two gating items; the paid social teaser has one day of slack.",
        decisions: ["Launch date locked: Nov 4", "Pricing copy is the gating item", "Paid social can slip to Oct 31"], actions: q4
      },
      {
        id: "pricing-readout", title: "Pricing experiment readout", source: "Fireflies", sourceKind: "fireflies", when: "Yesterday · 4:00 PM", date: addDays(-1), duration: "32 min", status: "review", confidence: 91, participants: ["maya", "daniel", "amara"],
        summary: "The annual-plan test cleared the bar on conversion but not on expansion revenue. The team agreed to ship a one-page readout before Sales enablement and revisit pricing in the next cycle.",
        decisions: ["Annual plan wins on conversion", "Expansion revenue needs another cycle", "Readout due before enablement"], actions: pricing
      },
      {
        id: "onboarding-crit", title: "Design critique — Onboarding v2", source: "Zoom", sourceKind: "zoom", when: "Yesterday · 11:00 AM", date: addDays(-1), duration: "50 min", status: "routed", confidence: 97, participants: ["maya", "priya", "daniel"],
        summary: "The new workspace picker tested well in five sessions. The team is moving forward with a smaller default workspace card and will instrument step 2 before the next build.",
        decisions: ["Workspace picker moves to build", "Step 2 gets instrumentation"], actions: onboarding
      },
      {
        id: "northwind", title: "Customer discovery — Northwind", source: "Fireflies", sourceKind: "fireflies", when: "Mon, Oct 26", date: addDays(-2), duration: "38 min", status: "routed", confidence: 95, participants: ["maya", "amara", "daniel"],
        summary: "Northwind is ready to move to a technical evaluation. Security review is the first gate; the platform team wants a deep-dive before committing to a pilot.",
        decisions: ["Northwind moves to technical eval", "Security questionnaire comes first"], actions: northwind
      },
      {
        id: "gtm-standup", title: "Weekly GTM standup", source: "Zoom", sourceKind: "zoom", when: "Fri, Oct 23", date: addDays(-5), duration: "28 min", status: "routed", confidence: 92, participants: ["maya", "sofia", "priya"],
        summary: "Launch comms are on track. The team is reusing the customer clip for a shorter teaser and tightening the enablement hub before the partner newsletter goes out.",
        decisions: ["Teaser cut from customer clip", "Partner newsletter stays on schedule"], actions: gtm
      }
    ];

    state.activity = [
      { actor: "maya", verb: "routed", count: 3, meeting: "Partner webinar", tools: ["notion", "trello"], time: "12m" },
      { actor: "priya", verb: "completed", count: 2, meeting: "Onboarding research", tools: ["notion"], time: "1h" },
      { actor: null, verb: "auto-routed", count: 3, meeting: "Customer council", tools: ["trello", "notion"], time: "3h" },
      { actor: "amara", verb: "routed", count: 2, meeting: "Renewal review", tools: ["notion"], time: "5h" }
    ];
  }

  // ------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------
  function renderAll() {
    refreshPeopleOptions();
    renderOverview();
    renderMeetings();
    renderActions();
    renderIntegrations();
    renderNavBadges();
  }

  function renderNavBadges() {
    const reviewMeetings = state.meetings.filter(m => m.status === "review").length;
    const reviewActions = allActions().filter(x => x.action.status === "review").length;
    $("#navMeetingBadge").textContent = reviewMeetings;
    $("#navActionBadge").textContent = reviewActions;
    $("#navActionBadge").style.display = reviewActions ? "grid" : "none";
    $("#navMeetingBadge").style.display = reviewMeetings ? "grid" : "none";
  }

  function renderOverview() {
    const review = state.meetings.filter(m => m.status === "review");
    const first = review[0];
    const slot = $("#reviewSlot");
    if (first) {
      const pending = first.actions.filter(a => a.status === "review");
      const heroActions = pending.length ? pending : first.actions;
      const tools = [...new Set(heroActions.map(a => a.destination))];
      slot.innerHTML = `
        <article class="hero">
          <div class="hero-top">
            <span class="pill-live"><i></i> Needs your review</span>
            <span class="hero-conf">${icon("sparkles")} ${first.confidence}% extraction confidence</span>
          </div>
          <div class="hero-body">
            <div class="hero-copy">
              <p class="hero-kicker">${esc(first.source)} · ${esc(first.when)}</p>
              <h2>${esc(first.title)}</h2>
              <p>${pending.length} action item${pending.length === 1 ? "" : "s"} extracted, owned, and ready to route. You're the last stop.</p>
              <div class="hero-people">
                <div class="avatar-stack">${first.participants.slice(0, 3).map(p => personAvatar(p)).join("")}${first.participants.length > 3 ? `<span class="more">+${first.participants.length - 3}</span>` : ""}</div>
                <span class="hero-meta">${icon("clock")} ${esc(first.duration)}</span>
              </div>
            </div>
            <div class="hero-tasks">
              ${heroActions.slice(0, 3).map(a => `<div class="hero-task">${toolIcon(a.destination)}<span class="hero-task-title">${esc(a.title)}</span>${personAvatar(a.owner)}</div>`).join("")}
              ${heroActions.length > 3 ? `<div class="hero-task-more">+ ${heroActions.length - 3} more ready to route</div>` : ""}
            </div>
          </div>
          <div class="hero-foot">
            <button class="btn btn-primary" data-review="${first.id}">Review ${pending.length || first.actions.length} action${(pending.length || first.actions.length) === 1 ? "" : "s"} ${icon("arrow-right")}</button>
            <button class="btn-ghost-dark" data-snooze="${first.id}">Later</button>
            <span class="hero-ai">${icon("sparkles")} Extracted in 38s · ${tools.length} destinations</span>
          </div>
        </article>
        ${review[1] ? `
        <button class="review-strip" data-review="${review[1].id}">
          <span class="strip-ico">${icon("sparkles")}</span>
          <span class="strip-copy"><b>Also waiting for you</b><small>${esc(review[1].title)} · ${review[1].actions.length} actions</small></span>
          <span class="strip-conf">${review[1].confidence}%</span>
          ${icon("chevron-right")}
        </button>` : ""}
      `;
    } else {
      slot.innerHTML = `
        <article class="hero hero-empty" style="min-height:220px;display:flex;flex-direction:column;justify-content:center">
          <span class="pill-live" style="align-self:flex-start"><i></i> Inbox zero</span>
          <h2 style="margin-top:14px">Every action has a home.</h2>
          <p style="color:#a6bdad">No meetings are waiting on you. Pull in a recording or paste a transcript to keep the streak alive.</p>
          <div style="margin-top:17px"><button class="btn btn-primary" data-new>${icon("plus")} Bring in a meeting</button></div>
        </article>`;
    }

    $("#statReview").textContent = review.length;
    $("#statRouted").textContent = state.routedTotal;
    $("#statHours").textContent = state.hoursSaved.toFixed(1);
    if ($("#statReviewMeta")) $("#statReviewMeta").textContent = `${review.length} meeting${review.length === 1 ? "" : "s"}`;

    $("#recentBody").innerHTML = state.meetings.slice(0, 4).map(m => {
      const tools = [...new Set(m.actions.map(a => a.destination))];
      return `<tr data-meeting="${m.id}" tabindex="0">
        <td style="padding-left:21px"><div class="mt-title">${sourceIcon(m.sourceKind)}<div class="mt-copy"><b>${esc(m.title)}</b><small>${esc(m.source)} · ${m.participants.length} people</small></div></div></td>
        <td><span style="font-size:10px;color:var(--muted);white-space:nowrap">${esc(m.when)}</span></td>
        <td><span class="count-chip">${m.actions.length}</span></td>
        <td>${statusPill(m.status)}</td>
        <td><div class="tool-chips">${tools.map(t => toolIcon(t)).join("")}${tools.length ? "" : `<span class="muted" style="font-size:9px">—</span>`}</div></td>
      </tr>`;
    }).join("");

    $("#activityList").innerHTML = state.activity.slice(0, 4).map(a => {
      const actor = a.actor ? personAvatar(a.actor) : `<span class="avatar av-relay">R</span>`;
      return `<li class="activity-item">
        <span class="act-avatar">${actor}${a.tools[0] ? `<i class="act-badge">${toolIcon(a.tools[0])}</i>` : ""}</span>
        <div class="act-body">
          <p>${a.actor ? `<b>${esc(personName(a.actor))}</b>` : "<b>Relay</b>"} ${esc(a.verb)} ${a.count} task${a.count === 1 ? "" : "s"} <span>from ${esc(a.meeting)}</span></p>
          <div class="act-tools">${a.tools.map(t => toolIcon(t)).join("")}</div>
        </div>
        <time class="act-time">${esc(a.time)}</time>
      </li>`;
    }).join("");

    const connected = ["notion", "jira", "trello"].filter(t => state.integrations[t].connected);
    $("#connectedCount").textContent = `${connected.length} of 3 routing`;
    $("#toolsList").innerHTML = ["notion", "jira", "trello"].map(t => `
      <button class="tool-row" data-page="integrations">
        ${toolIcon(t)}
        <b>${TOOL_META[t].name}</b>
        <span class="conn-dot ${state.integrations[t].connected ? "" : "off"}"></span>
        <small>${state.integrations[t].connected ? esc(state.integrations[t].project) : "Off"}</small>
        ${icon("chevron-right")}
      </button>`).join("");

    const d = new Date();
    if ($("#greeting")) $("#greeting").textContent = d.getHours() < 12 ? "Good morning" : d.getHours() < 18 ? "Good afternoon" : "Good evening";
    $("#dateMonth").textContent = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    $("#dateDay").textContent = d.getDate();
    $("#todayLine").textContent = fmtLong(d).toUpperCase();
  }

  function renderMeetings() {
    const counts = {
      all: state.meetings.length,
      review: state.meetings.filter(m => m.status === "review").length,
      routed: state.meetings.filter(m => m.status === "routed").length
    };
    $("#mCountAll").textContent = counts.all;
    $("#mCountReview").textContent = counts.review;
    $("#mCountRouted").textContent = counts.routed;
    $$("#meetingFilters button").forEach(b => b.classList.toggle("active", b.dataset.meetingFilter === state.meetingFilter));

    const filtered = state.meetings.filter(m => state.meetingFilter === "all" || m.status === state.meetingFilter);
    $("#meetingsList").innerHTML = filtered.length ? filtered.map(m => {
      const tools = [...new Set(m.actions.map(a => a.destination))];
      return `<button class="meeting-row" data-meeting="${m.id}">
        ${sourceIcon(m.sourceKind)}
        <span class="meeting-main"><span class="meeting-name">${esc(m.title)}</span><span class="meeting-sub">${esc(m.summary)}</span></span>
        <span class="meeting-when">${esc(m.when)}<small>${esc(m.duration)}</small></span>
        <span class="meeting-count">${m.actions.length}<small>actions</small></span>
        <span class="meeting-status">${statusPill(m.status)}<span class="tools-inline tool-chips">${tools.map(t => toolIcon(t)).join("")}</span></span>
        ${icon("chevron-right")}
      </button>`;
    }).join("") : `<div class="actions-empty"><div class="empty-ico">${icon("calendar")}</div><h4>No meetings here yet</h4><p>Try another filter, or bring in a new conversation.</p></div>`;
  }

  function renderActions() {
    let items = allActions();
    const f = state.actionFilter;
    const q = f.q.trim().toLowerCase();
    items = items.filter(({ action: a, meeting: m }) => {
      if (q && !(`${a.title} ${m.title} ${PEOPLE[a.owner]?.name || ""}`.toLowerCase().includes(q))) return false;
      if (f.owner !== "all" && a.owner !== f.owner) return false;
      if (f.tool !== "all" && a.destination !== f.tool) return false;
      if (f.status !== "all" && a.status !== f.status) return false;
      return true;
    });
    items.sort((x, y) => {
      const rank = { review: 0, routed: 1, done: 2 };
      if (rank[x.action.status] !== rank[y.action.status]) return rank[x.action.status] - rank[y.action.status];
      if (x.action.due && y.action.due) return x.action.due.localeCompare(y.action.due);
      return x.action.due ? -1 : y.action.due ? 1 : 0;
    });

    const all = allActions();
    $("#kpiAwaiting").textContent = all.filter(x => x.action.status === "review").length;
    $("#kpiRouted").textContent = all.filter(x => x.action.status === "routed").length;
    $("#kpiDone").textContent = all.filter(x => x.action.status === "done").length;
    $("#kpiOverdue").textContent = all.filter(x => isOverdue(x.action)).length;

    $("#actionsList").innerHTML = items.length ? items.map(({ action: a, meeting: m }) => {
      const done = a.status === "done";
      return `<div class="action-item ${done ? "done" : ""}" data-meeting="${m.id}" tabindex="0">
        <button class="task-check ${done ? "on" : ""}" data-done="${a.id}" aria-label="${done ? "Mark incomplete" : "Mark complete"}">${done ? icon("check") : ""}</button>
        <div class="task-main">
          <div class="task-title">${esc(a.title)}</div>
          <div class="task-sub"><span class="priority-dot ${a.priority}"></span>${a.priority} · ${esc(m.title)}</div>
        </div>
        <div class="task-owner">${personAvatar(a.owner)}<span>${esc(personName(a.owner))}</span></div>
        <div class="task-due ${isOverdue(a) ? "overdue" : ""}">${icon("calendar")} ${fmtDay(a.due)}</div>
        <div class="task-dest">${toolIcon(a.destination)}<span>${TOOL_META[a.destination].name}</span><small>${esc(state.integrations[a.destination].project)}</small></div>
        ${statusPill(a.status)}
        ${icon("chevron-right")}
      </div>`;
    }).join("") : `<div class="actions-empty"><div class="empty-ico">${icon("check-square")}</div><h4>No action items match</h4><p>Clear a filter or search for something else.</p></div>`;

    $$("#actionStatusFilters button").forEach(b => b.classList.toggle("active", b.dataset.actionStatus === f.status));
  }

  function renderIntegrations() {
    const connectedTools = ["notion", "jira", "trello", "slack"].filter(t => state.integrations[t].connected).length;
    if ($("#integrationSummary")) {
      $("#integrationSummary").innerHTML = connectedTools === 4
        ? `<span class="pulse-dot"></span> All systems healthy · 100% delivery this week`
        : `<span class="pulse-dot" style="background:#d4a33d"></span> ${connectedTools} of 4 tools connected · routing is limited`;
    }
    $("#integrationGrid").innerHTML = ["notion", "jira", "trello", "slack"].map(t => {
      const meta = TOOL_META[t], int = state.integrations[t];
      return `<article class="integration-card card">
        <div class="int-top">${toolIcon(t, "lg")}<span class="conn-state ${int.connected ? "" : "off"}"><i></i>${int.connected ? "Connected" : "Off"}</span></div>
        <h3>${meta.name}</h3>
        <p>${meta.desc}${t === "slack" ? " · notifications" : ""}</p>
        <div class="int-map"><span>${meta.projectLabel}</span><b>${int.connected ? esc(int.project) : "Not connected"}</b></div>
        <div class="int-foot">
          <button class="text-btn" data-configure="${t}">Configure ${icon("arrow-right")}</button>
          <button class="switch ${int.connected ? "on" : ""}" data-toggle-tool="${t}" role="switch" aria-checked="${int.connected}" aria-label="Toggle ${meta.name}"><span></span></button>
        </div>
      </article>`;
    }).join("");

    $("#ruleList").innerHTML = state.rules.map((r, i) => `<div class="rule-row">
      <span class="rule-order">0${i + 1}</span>
      <span class="rule-if"><em>IF</em> ${r.when}</span>
      <span class="rule-arrow">${icon("arrow-right")}</span>
      <span class="rule-then">${r.then}</span>
      <button class="switch ${r.on ? "on" : ""}" data-rule="${r.id}" role="switch" aria-checked="${r.on}" aria-label="Toggle rule"><span></span></button>
    </div>`).join("");
  }

  // ------------------------------------------------------------
  // Navigation + palette
  // ------------------------------------------------------------
  const PAGE_NAMES = { overview: "Overview", meetings: "Meetings", actions: "Action items", integrations: "Integrations" };

  function navigate(page, opts = {}) {
    if (!PAGE_NAMES[page]) page = "overview";
    state.page = page;
    $$(".page").forEach(p => p.classList.toggle("active", p.dataset.pagePanel === page));
    $$(".nav-item").forEach(n => {
      const matches = n.dataset.page === page && !n.dataset.scroll;
      n.classList.toggle("active", matches);
    });
    $("#crumbPage").textContent = PAGE_NAMES[page];
    if (!opts.fromHash) {
      try { history.replaceState(null, "", "#" + page); } catch (err) { /* file:// origins can reject history writes */ }
    }
    document.body.classList.remove("nav-open");
    if (opts.scroll === "rules") {
      setTimeout(() => $("#rules")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } else if (!opts.keepScroll) {
      window.scrollTo({ top: 0, behavior: opts.instant ? "auto" : "smooth" });
    }
  }

  let paletteSel = 0;
  let paletteItems = [];
  function openPalette() {
    $("#palette").classList.add("open");
    $("#paletteInput").value = "";
    paletteSel = 0;
    renderPalette("");
    setTimeout(() => $("#paletteInput").focus(), 50);
  }
  function closePalette() { $("#palette").classList.remove("open"); }
  function paletteNavItems() {
    return [
      { type: "page", page: "overview", title: "Overview", sub: "Dashboard & meeting inbox", icon: "grid" },
      { type: "page", page: "meetings", title: "Meetings", sub: "All transcribed conversations", icon: "calendar" },
      { type: "page", page: "actions", title: "Action items", sub: "Everything that needs doing", icon: "check-square" },
      { type: "page", page: "integrations", title: "Integrations", sub: "Notion, Jira, Trello & rules", icon: "plug" }
    ];
  }
  function renderPalette(q) {
    const query = q.trim().toLowerCase();
    const pages = paletteNavItems().filter(p => !query || `${p.title} ${p.sub}`.toLowerCase().includes(query));
    const meetings = state.meetings.filter(m => !query || `${m.title} ${m.summary}`.toLowerCase().includes(query)).slice(0, 4);
    const actions = allActions().filter(x => query && `${x.action.title} ${x.meeting.title}`.toLowerCase().includes(query)).slice(0, 5);
    const pageItems = pages.map(p => ({ ...p, kind: "page" }));
    const meetingItems = meetings.map(m => ({ type: "meeting", id: m.id, title: m.title, sub: `${m.source} · ${m.actions.length} actions`, icon: "calendar", kind: "meeting" }));
    const actionItems = actions.map(x => ({ type: "action", id: x.action.id, title: x.action.title, sub: `${x.meeting.title} · ${personName(x.action.owner)}`, icon: "check-square", kind: "action" }));
    paletteItems = [...pageItems, ...meetingItems, ...actionItems];
    if (paletteSel >= paletteItems.length) paletteSel = 0;
    let html = "";
    if (pageItems.length) html += `<div class="palette-label">Jump to</div>` + pageItems.map((p, i) => paletteItemHTML(p, i)).join("");
    if (meetingItems.length) html += `<div class="palette-label">Meetings</div>` + meetingItems.map((m, i) => paletteItemHTML(m, pageItems.length + i)).join("");
    if (actionItems.length) html += `<div class="palette-label">Action items</div>` + actionItems.map((a, i) => paletteItemHTML(a, pageItems.length + meetingItems.length + i)).join("");
    if (!html) html = `<div class="palette-empty">No results for “${esc(q)}”. Try a meeting or task name.</div>`;
    $("#paletteResults").innerHTML = html;
    $$(".palette-item").forEach((el, i) => el.classList.toggle("sel", i === paletteSel));
  }
  function paletteItemHTML(item, index) {
    return `<button class="palette-item ${index === paletteSel ? "sel" : ""}" data-palette-index="${index}">
      <span class="pi-ico">${icon(item.icon)}</span>
      <span class="pi-copy"><b>${esc(item.title)}</b><span>${esc(item.sub || "")}</span></span>
      <span class="pi-meta">${item.kind === "page" ? "Open" : item.kind === "meeting" ? "Meeting" : "Task"}</span>
    </button>`;
  }
  function activatePaletteItem(item) {
    if (!item) return;
    closePalette();
    if (item.kind === "page") navigate(item.page);
    if (item.kind === "meeting") openMeeting(item.id);
    if (item.kind === "action") {
      state.actionFilter.q = item.title;
      state.actionFilter.status = "all";
      if ($("#actionSearch")) $("#actionSearch").value = item.title;
      navigate("actions");
      renderActions();
    }
  }

  // ------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------
  function toast(title, msg, tone = "success") {
    const el = document.createElement("div");
    el.className = "toast " + tone;
    el.innerHTML = `<span class="toast-ico">${icon(tone === "error" ? "alert" : "check")}</span><div class="toast-copy"><b>${esc(title)}</b><span>${esc(msg)}</span></div><button class="toast-close" aria-label="Dismiss">${icon("x")}</button>`;
    $("#toasts").appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    const remove = () => { el.classList.remove("in"); setTimeout(() => el.remove(), 240); };
    el.querySelector(".toast-close").addEventListener("click", remove);
    setTimeout(remove, 4300);
  }

  // ------------------------------------------------------------
  // Modal plumbing
  // ------------------------------------------------------------
  let modalBusy = false;
  function openModal(html, variant = "") {
    modalBusy = false;
    $("#modalCard").dataset.variant = variant;
    $("#modalBody").innerHTML = html;
    $("#modal").classList.add("open");
    document.body.classList.add("modal-open");
    if (variant === "import" && window.innerWidth > 640) setTimeout(() => $("#transcriptInput")?.focus({ preventScroll: true }), 80);
  }
  function closeModal() {
    if (modalBusy) return;
    const card = $("#modalCard");
    if (card.dataset.variant === "review") {
      const meeting = state.meetings.find(x => x.id === card.dataset.reviewMeeting);
      if (meeting) {
        syncDraft(meeting);
        renderAll();
      }
    }
    $("#modal").classList.remove("open");
    document.body.classList.remove("modal-open");
    $("#modalBody").innerHTML = "";
  }
  const modalCloseButton = () => `<button class="modal-x" data-close aria-label="Close">${icon("x")}</button>`;

  // ------------------------------------------------------------
  // Import
  // ------------------------------------------------------------
  function openImport(tab = "paste") {
    openModal(`
      <div class="modal-shell import-shell">
        ${modalCloseButton()}
        <header class="import-head">
          <p class="eyebrow">New meeting</p>
          <h2>Bring in a meeting.</h2>
          <p>Drop a Zoom, Meet, or Fireflies recording, or paste a transcript. Relay extracts the decisions, owners, and next steps — no note-taking.</p>
        </header>
        <div class="source-tabs" role="tablist">
          <button class="source-tab ${tab === "paste" ? "active" : ""}" data-source-tab="paste">${icon("file")} Paste transcript</button>
          <button class="source-tab ${tab === "upload" ? "active" : ""}" data-source-tab="upload">${icon("upload")} Upload audio</button>
        </div>
        <div class="source-panel ${tab === "paste" ? "" : "hidden"}" data-panel="paste">
          <div class="transcript-wrap">
            <div class="transcript-head"><span>Transcript</span><button class="text-btn" id="sampleBtn">${icon("sparkles")} Use sample transcript</button></div>
            <textarea id="transcriptInput" placeholder="Paste your meeting transcript here. Speaker labels help Relay assign owners — e.g. &quot;Priya: I'll send the brief by Friday.&quot;"></textarea>
            <div class="transcript-foot"><span id="charCount">0 characters</span><span>We never train on your data.</span></div>
          </div>
        </div>
        <div class="source-panel ${tab === "upload" ? "" : "hidden"}" data-panel="upload">
          <label class="dropzone" id="dropzone">
            <input type="file" id="audioInput" accept="audio/*,.txt,.vtt,.srt" hidden>
            <span class="drop-icon">${icon("mic")}</span>
            <b>Drop an audio file, or browse</b>
            <span>MP3, M4A, WAV, VTT · up to 200 MB</span>
            <em id="fileName">Whisper transcription with speaker labels.</em>
          </label>
          <div class="upload-hint">${icon("zap")} Powered by Whisper. Speaker diarization included.</div>
        </div>
        <div class="import-fields">
          <label class="field"><span>Meeting title</span><input id="meetingTitle" placeholder="e.g. Q4 Launch — Weekly Sync" maxlength="80"></label>
          <label class="field"><span>Source</span><select id="meetingSource"><option>Google Meet</option><option>Zoom</option><option>Fireflies</option><option>Other</option></select></label>
        </div>
        <div class="import-error" id="importError"></div>
        <footer class="modal-foot">
          <span class="privacy">${icon("lock")} Local demo · transcript stays in your browser</span>
          <div class="foot-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="analyzeBtn">${icon("sparkles")} Extract actions</button></div>
        </footer>
      </div>
    `, "import");

    const transcript = $("#transcriptInput");
    transcript.addEventListener("input", () => {
      $("#charCount").textContent = `${transcript.value.length.toLocaleString()} characters`;
      $("#importError").textContent = "";
    });
    $("#sampleBtn").addEventListener("click", () => {
      setSourceTab("paste");
      transcript.value = SAMPLE_TRANSCRIPT;
      $("#charCount").textContent = `${transcript.value.length.toLocaleString()} characters`;
      $("#meetingTitle").value = "Q4 Launch — Weekly Sync";
      $("#meetingSource").value = "Google Meet";
      $("#importError").textContent = "";
      transcript.focus();
    });
    $$(".source-tab").forEach(b => b.addEventListener("click", () => setSourceTab(b.dataset.sourceTab)));
    $("#audioInput").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      $("#fileName").textContent = f.name;
      if (!$("#meetingTitle").value) $("#meetingTitle").value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      $("#importError").textContent = "";
    });
    const drop = $("#dropzone");
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", e => {
      const f = e.dataTransfer.files[0];
      if (!f) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(f);
        $("#audioInput").files = dt.files;
      } catch (err) { /* the file picker remains available */ }
      $("#fileName").textContent = f.name;
      if (!$("#meetingTitle").value) $("#meetingTitle").value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      $("#importError").textContent = "";
    });
    $("#analyzeBtn").addEventListener("click", analyzeImport);
  }

  function setSourceTab(tab) {
    $$(".source-tab").forEach(b => b.classList.toggle("active", b.dataset.sourceTab === tab));
    $$(".source-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== tab));
  }

  async function analyzeImport() {
    const activeTab = $(".source-tab.active")?.dataset.sourceTab || "paste";
    const title = $("#meetingTitle").value.trim() || "Imported meeting";
    let transcript = "";
    if (activeTab === "upload") {
      const file = $("#audioInput").files[0];
      if (!file) { $("#importError").textContent = "Choose a recording first, or switch to Paste transcript."; return; }
      $("#importError").textContent = "";
      transcript = SAMPLE_TRANSCRIPT;
    } else {
      transcript = $("#transcriptInput").value.trim();
      if (transcript.length < 40) { $("#importError").textContent = "Paste a little more of the conversation so Relay has something to work with."; return; }
      $("#importError").textContent = "";
    }
    await runProcessing({ title, transcript, source: $("#meetingSource").value, activeTab });
  }

  async function runProcessing({ title, transcript, source, activeTab }) {
    const steps = [
      ...(activeTab === "upload" ? ["Transcribing with Whisper", "Detecting speakers & decisions"] : ["Reading transcript", "Detecting speakers & decisions"]),
      "Extracting action items",
      "Matching owners & due dates"
    ];
    openModal(`
      <div class="modal-shell process-shell">
        <div class="process-orb"><div class="wavebars">${[14, 24, 34, 20, 30, 16, 26, 10, 22, 30, 18, 12].map((h, i) => `<i style="height:${h}px;animation-delay:${i * .07}s"></i>`).join("")}</div></div>
        <p class="eyebrow">Relay is listening</p>
        <h2>Finding the work in<br><em>${esc(title)}</em></h2>
        <p class="process-sub">Pulling out decisions, action items, owners, and dates — then choosing the best home for each one.</p>
        <div class="process-steps" id="processSteps">
          ${steps.map((s, i) => `<div class="process-step" data-step="${i}"><span class="step-dot"></span><span>${s}</span><span class="step-state">Queued</span></div>`).join("")}
        </div>
        <div class="process-meter"><span id="processBar"></span></div>
      </div>
    `, "processing");
    modalBusy = true;

    for (let i = 0; i < steps.length; i++) {
      const el = $(`.process-step[data-step="${i}"]`);
      if (!el) break;
      el.classList.add("active");
      el.querySelector(".step-state").textContent = "Working";
      $("#processBar").style.width = `${8 + ((i + .5) / steps.length) * 88}%`;
      await delay(i === 0 ? 520 : 430);
      el.classList.remove("active");
      el.classList.add("done");
      el.querySelector(".step-state").textContent = "Done";
      $("#processBar").style.width = `${8 + ((i + 1) / steps.length) * 88}%`;
      await delay(90);
    }
    await delay(260);
    modalBusy = false;

    const extraction = extractMeeting(transcript, title, source, activeTab);
    const meeting = makeMeeting(extraction);
    state.meetings.unshift(meeting);
    renderAll();
    openReview(meeting.id);
    toast("Meeting understood", `We found ${meeting.actions.length} action items across ${meeting.participants.length} people.`);
  }

  // ------------------------------------------------------------
  // Extraction heuristics (demo for the LLM JSON contract)
  // ------------------------------------------------------------
  const WEEKDAYS = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
  const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };

  function parseDue(text) {
    const s = text.toLowerCase();
    if (/\b(end of day|eod|today)\b/.test(s)) return addDays(0);
    if (/\btomorrow\b/.test(s)) return addDays(1);
    if (/\bnext week\b/.test(s)) return addDays(7);
    const wd = s.match(/\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/);
    if (wd) {
      const target = WEEKDAYS[wd[2]];
      let diff = (target - TODAY.getDay() + 7) % 7;
      if (wd[1] && diff === 0) diff = 7;
      return addDays(diff);
    }
    const md = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/);
    if (md) {
      let d = new Date(TODAY.getFullYear(), MONTHS[md[1]], Number(md[2]));
      if (d < TODAY) d = new Date(TODAY.getFullYear() + 1, MONTHS[md[1]], Number(md[2]));
      return iso(d);
    }
    return "";
  }

  function stripDue(title) {
    return title
      .replace(/\s*\b(?:by|before|on)\s+(?:end of day|eod|today|tomorrow|next week|next\s+\w+day|\w+day|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})\b/ig, "")
      .replace(/\s*\b(?:end of day|eod|today|tomorrow|next week)\b\s*$/ig, "")
      .trim();
  }

  function cleanTitle(sentence, vocative) {
    let t = sentence.trim();
    if (vocative) {
      t = t.replace(new RegExp(`^\\s*${vocative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},?\\s*`, "i"), "");
    }
    const cue = /\b(?:I'll|I will|I’m going to|I am going to|I can|can you|could you|please|we need to|we should|action item:)\b/i;
    const m = t.match(cue);
    if (m) t = t.slice(m.index + m[0].length);
    t = t.replace(/^\s*(also|then|just|really|go ahead and)\s+/i, "");
    t = stripDue(t);
    t = t.replace(/\s+/g, " ").replace(/^[\s,;:—-]+|[\s,;:—-]+$/g, "").replace(/[.?!]+$/, "").trim();
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function titleTokens(title) {
    const stop = new Set("the a an and or to of for in on with by from before after it this that is are be will can you i we our their at as into".split(" "));
    return title.toLowerCase().replace(/[^a-z0-9# ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  }
  function similar(a, b) {
    const A = new Set(titleTokens(a)), B = new Set(titleTokens(b));
    if (!A.size || !B.size) return false;
    let hit = 0;
    A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size) >= .62;
  }
  function lookupPerson(name) {
    const clean = name.trim().replace(/[^A-Za-z .'-]/g, "");
    if (!clean) return null;
    const lower = clean.toLowerCase();
    const first = lower.split(/\s+/)[0];
    const found = Object.entries(PEOPLE).find(([, p]) => p.name.toLowerCase() === lower || p.name.toLowerCase().split(" ")[0] === first);
    return found ? found[0] : null;
  }
  function findPersonByName(name) {
    const clean = name.trim().replace(/[^A-Za-z .'-]/g, "");
    if (!clean) return null;
    const known = lookupPerson(clean);
    if (known) return known;
    const key = `guest-${Object.keys(PEOPLE).length}`;
    const initials = clean.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "??";
    const color = GUEST_COLORS[Object.keys(PEOPLE).length % GUEST_COLORS.length];
    PEOPLE[key] = { name: clean, initials, role: "Guest" };
    const style = document.createElement("style");
    style.textContent = `.av-${key}{background:${color.bg};color:${color.fg}}`;
    document.head.appendChild(style);
    return key;
  }

  function applyRoutingRules(item) {
    if (item.priority === "urgent" && state.rules.find(r => r.id === "urgent")?.on) item.destination = "jira";
    else if (/\b(legal|copy|contract|doc|brief)\b/i.test(item.title) && state.rules.find(r => r.id === "legal")?.on) item.destination = "notion";
    else if (/\b(social|teaser|asset|campaign)\b/i.test(item.title) && state.rules.find(r => r.id === "social")?.on) item.destination = "trello";
  }
  function destinationFor(title) {
    if (/\b(bug|api|webhook|deploy|checkout|ticket|endpoint|instrument|event|infra|release)\b/i.test(title)) return "jira";
    if (/\b(social|teaser|asset|campaign|clip|newsletter|utm|board)\b/i.test(title)) return "trello";
    return "notion";
  }

  function extractMeeting(transcript, title, source, activeTab) {
    const rawLines = transcript.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const participants = [];
    const candidates = [];
    let lastSpeaker = null;

    for (const line of rawLines) {
      const match = line.match(/^(?:\[?[\d:.]+\]?\s*)?([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?)\s*:\s*(.+)$/);
      let speaker = null, body = line;
      if (match) { speaker = match[1]; body = match[2]; }
      if (speaker) {
        const key = findPersonByName(speaker);
        if (key) {
          speaker = key;
          if (!participants.includes(key)) participants.push(key);
          lastSpeaker = key;
        }
      } else {
        speaker = lastSpeaker;
      }

      const lineUrgent = /\b(blocker|urgent|asap|critical|gating)\b/i.test(body);
      const sentences = (body.match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim()).filter(Boolean);
      for (const raw of sentences) {
        const sentence = raw.trim();
        if (sentence.length < 12) continue;
        const hasFirstPerson = /\b(I'll|I will|I’m going to|I am going to|I can)\b/i.test(sentence);
        const hasDirective = /\b(can you|could you|please)\b/i.test(sentence);
        const hasNeed = /\b(we need to|we should|action item:)\b/i.test(sentence);
        if (!hasFirstPerson && !hasDirective && !hasNeed) continue;
        if (/\b(can't|cannot|won't|will not|not going to)\b/i.test(sentence) && !hasDirective) continue;

        let vocative = null;
        const vocMatch = sentence.match(/^\s*(?:okay|ok|so|and|great)?[,\s]*([A-Z][a-z]+),/);
        if (vocMatch && lookupPerson(vocMatch[1])) vocative = vocMatch[1];
        let owner = speaker;
        if ((hasDirective || hasNeed) && vocative) owner = lookupPerson(vocative);
        if (!owner) owner = "maya";

        const actionTitle = cleanTitle(sentence, vocative);
        if (!actionTitle || actionTitle.length < 10) continue;
        if (/^(it|that|this|them|him|her)\b/i.test(actionTitle) && actionTitle.split(/\s+/).length < 5) continue;
        if (/\b(right|isn't it|does that work)\??$/i.test(actionTitle)) continue;

        const due = parseDue(sentence);
        let priority = "medium";
        if (lineUrgent || /\b(blocker|urgent|asap|critical|gating)\b/i.test(sentence)) priority = "urgent";
        else if (due && (dateFromISO(due) - TODAY) / DAY <= 1) priority = "high";
        else if (/\b(high priority|before launch|important)\b/i.test(sentence)) priority = "high";

        const item = {
          title: actionTitle,
          owner,
          due,
          destination: destinationFor(actionTitle),
          priority,
          confidence: hasFirstPerson ? 96 : hasDirective ? 92 : 88,
          status: "review"
        };
        applyRoutingRules(item);
        if (candidates.some(c => similar(c.title, item.title))) continue;
        candidates.push(item);
      }
    }

    if (!participants.length) participants.push("maya");
    const decisions = [];
    for (const line of rawLines) {
      const body = line.replace(/^[^:]{2,40}:\s*/, "").trim();
      const clauses = (body.match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim()).filter(Boolean);
      for (const clause of clauses) {
        if (/[?]\s*$/.test(clause)) continue;
        if (candidates.some(c => similar(c.title, clause))) continue;
        if (/\b(stays|locked|decided|agreed|will ship|ships|slip|targeting|gating item)\b/i.test(clause) && clause.length < 110) {
          const text = clause.replace(/[.?!]+$/, "").replace(/^(perfect|great|okay|ok|so|and)[,.\s]+/i, "").trim();
          if (text && !decisions.includes(text)) decisions.push(text.charAt(0).toUpperCase() + text.slice(1));
        }
      }
    }
    const avg = Math.round(candidates.reduce((n, c) => n + c.confidence, 0) / (candidates.length || 1));
    const context = transcript.toLowerCase();
    const summary = context.includes("launch")
      ? "The team held the launch date and split ownership across the gating work. Pricing copy and checkout reliability need to land first; launch comms, customer proof, and paid social are moving in parallel."
      : `The conversation produced ${candidates.length} clear commitments across ${participants.length} participants. Relay matched owners, dates, and the most sensible destination for each one.`;
    const kindFromSource = sourceKindFromName(source);
    const sourceKind = kindFromSource === "other" && activeTab === "upload" ? "upload" : kindFromSource;
    return { title, source, sourceKind, participants, actions: candidates, decisions: decisions.slice(0, 3), summary, confidence: Math.max(86, avg) };
  }

  function makeMeeting(data) {
    return {
      id: "m-" + Date.now(),
      title: data.title,
      source: data.source,
      sourceKind: data.sourceKind,
      when: "Just now",
      date: addDays(0),
      duration: "—",
      status: "review",
      confidence: data.confidence,
      participants: data.participants,
      summary: data.summary,
      decisions: data.decisions.length ? data.decisions : ["Owners and next steps confirmed"],
      actions: data.actions.map((a, i) => ({ ...a, id: `a-${Date.now()}-${i}` }))
    };
  }

  // ------------------------------------------------------------
  // Review & route
  // ------------------------------------------------------------
  function openReview(meetingId) {
    const m = state.meetings.find(x => x.id === meetingId);
    if (!m) { toast("Meeting not found", "That meeting is no longer in the demo.", "error"); return; }
    const checked = m.actions.filter(a => a.status === "review").length;
    openModal(`
      <div class="modal-shell review-shell">
        ${modalCloseButton()}
        <header class="review-head">
          <div class="review-head-main">
            <p class="eyebrow">Review &amp; route</p>
            <h2>${esc(m.title)}</h2>
            <div class="review-meta">
              <span class="src">${sourceIcon(m.sourceKind)} ${esc(m.source)}</span>
              <span class="sep">·</span><span>${esc(m.when)}</span>
              <span class="sep">·</span><span>${m.participants.length} participants</span>
              <span class="pill ai no-dot">${icon("sparkles", "i-sm")} ${m.confidence}% confidence</span>
            </div>
          </div>
          <div class="avatar-stack">${m.participants.slice(0, 4).map(p => personAvatar(p)).join("")}${m.participants.length > 4 ? `<span class="more">+${m.participants.length - 4}</span>` : ""}</div>
        </header>
        <div class="review-scroll">
          <div class="ai-summary">
            <span class="ai-summary-icon">${icon("sparkles")}</span>
            <div>
              <div class="ai-summary-label">Meeting summary</div>
              <p>${esc(m.summary)}</p>
              <div class="decisions">${m.decisions.map(d => `<span class="decision">${esc(d)}</span>`).join("")}</div>
            </div>
          </div>
          <div class="review-list-head">
            <div><b>${m.actions.length} action item${m.actions.length === 1 ? "" : "s"}</b><span>Uncheck anything that isn't real work. Every field is editable.</span></div>
            <label class="select-all"><input type="checkbox" id="selectAll" ${checked === m.actions.length && m.actions.length > 0 ? "checked" : ""}> Select all</label>
          </div>
          <div class="review-items" id="reviewItems">
            ${m.actions.map(a => reviewItemHTML(a)).join("")}
          </div>
          <button class="add-item" id="addItem">${icon("plus")} Add an action item</button>
        </div>
        <footer class="review-foot">
          <div class="route-summary">
            <span class="route-ico">${icon("route")}</span>
            <div><b id="routeCount">${checked} action${checked === 1 ? "" : "s"}</b><span id="routeBreakdown">ready to route</span></div>
          </div>
          <div class="route-actions">
            <div class="bulk-route"><span>Route all to</span><select id="bulkDest"><option value="">Keep individual</option><option value="notion">Notion</option><option value="jira">Jira</option><option value="trello">Trello</option></select></div>
            <button class="btn btn-primary" id="pushBtn">Push tasks ${icon("arrow-right")}</button>
          </div>
        </footer>
      </div>
    `, "review");
    $("#modalCard").dataset.reviewMeeting = m.id;
    bindReview(m);
    updateRouteSummary();
  }

  function reviewItemHTML(a) {
    return `<div class="review-item" data-id="${a.id}">
      <label class="review-check"><input type="checkbox" class="item-check" ${a.status === "review" ? "checked" : ""}><span></span></label>
      <div class="review-item-main">
        <input class="review-title" value="${escAttr(a.title)}" aria-label="Action item title">
        <div class="review-meta-row">
          <label class="meta-control">${personAvatar(a.owner)}<select class="item-owner" aria-label="Owner">${Object.entries(PEOPLE).map(([k, p]) => `<option value="${k}" ${k === a.owner ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
          <label class="meta-control">${icon("calendar")}<input type="date" class="item-due" value="${a.due || ""}" aria-label="Due date"></label>
          <label class="meta-control dest-control">${toolIcon(a.destination)}<select class="item-dest" aria-label="Destination"><option value="notion" ${a.destination === "notion" ? "selected" : ""}>Notion</option><option value="jira" ${a.destination === "jira" ? "selected" : ""}>Jira</option><option value="trello" ${a.destination === "trello" ? "selected" : ""}>Trello</option></select></label>
          <span class="priority-chip ${a.priority}">${a.priority}</span>
          <span class="conf">${a.confidence}% match</span>
        </div>
      </div>
      <button class="remove-item" data-remove="${a.id}" aria-label="Remove action item">${icon("x")}</button>
    </div>`;
  }

  function bindReview(m) {
    $("#selectAll").addEventListener("change", e => {
      $$(".item-check").forEach(c => c.checked = e.target.checked);
      updateRouteSummary();
    });
    $("#reviewItems").addEventListener("change", e => {
      if (e.target.classList.contains("item-check")) {
        const all = $$(".item-check");
        const checked = all.filter(c => c.checked);
        $("#selectAll").checked = checked.length === all.length && all.length > 0;
        $("#selectAll").indeterminate = checked.length > 0 && checked.length < all.length;
        updateRouteSummary();
      }
      if (e.target.classList.contains("item-dest")) {
        const row = e.target.closest(".review-item");
        const oldIcon = row.querySelector(".dest-control .tool-ico");
        if (oldIcon) oldIcon.outerHTML = toolIcon(e.target.value);
        updateRouteSummary();
      }
      if (e.target.classList.contains("item-owner")) {
        const row = e.target.closest(".review-item");
        const oldAvatar = row.querySelector(".meta-control .avatar");
        if (oldAvatar) oldAvatar.outerHTML = personAvatar(e.target.value);
      }
    });
    $("#reviewItems").addEventListener("input", e => {
      if (e.target.classList.contains("review-title")) {
        const row = e.target.closest(".review-item");
        const a = m.actions.find(x => x.id === row.dataset.id);
        if (a) a.title = e.target.value;
      }
    });
    $("#addItem").addEventListener("click", () => {
      syncDraft(m);
      const id = "a-" + Date.now();
      m.actions.push({ id, title: "New action item", owner: "maya", due: addDays(1), destination: "notion", priority: "medium", confidence: 88, status: "review" });
      m.status = "review";
      $("#reviewItems").innerHTML = m.actions.map(a => reviewItemHTML(a)).join("");
      updateRouteSummary();
      const last = $(`.review-item[data-id="${id}"] .review-title`);
      if (last) { last.focus(); last.select(); }
    });
    $("#bulkDest").addEventListener("change", e => {
      if (!e.target.value) return;
      $$(".review-item").forEach(row => {
        if (!row.querySelector(".item-check").checked) return;
        const sel = row.querySelector(".item-dest");
        sel.value = e.target.value;
        const oldIcon = row.querySelector(".dest-control .tool-ico");
        if (oldIcon) oldIcon.outerHTML = toolIcon(e.target.value);
      });
      updateRouteSummary();
      toast("Destination applied", `Selected items now point to ${TOOL_META[e.target.value].name}.`);
    });
    $("#pushBtn").addEventListener("click", () => pushReview(m));
  }

  function syncDraft(m) {
    $$(".review-item").forEach(row => {
      const a = m.actions.find(x => x.id === row.dataset.id);
      if (!a) return;
      a.title = row.querySelector(".review-title").value.trim() || a.title;
      a.owner = row.querySelector(".item-owner").value;
      a.due = row.querySelector(".item-due").value;
      a.destination = row.querySelector(".item-dest").value;
    });
  }

  function updateRouteSummary() {
    const checked = $$(".item-check").filter(c => c.checked);
    const dests = [...new Set(checked.map(c => c.closest(".review-item").querySelector(".item-dest").value))];
    $("#routeCount").textContent = `${checked.length} action${checked.length === 1 ? "" : "s"}`;
    $("#routeBreakdown").textContent = checked.length ? `ready for ${dests.map(d => TOOL_META[d].name).join(", ")}` : "Select at least one";
    $("#pushBtn").disabled = checked.length === 0;
  }

  function nextRef(tool) {
    state.refs[tool] = (state.refs[tool] || 100) + 1;
    if (tool === "notion") return `NOT-${state.refs[tool]}`;
    if (tool === "jira") return `ENG-${state.refs[tool]}`;
    return `TRL-${state.refs[tool]}`;
  }

  function pushReview(m) {
    syncDraft(m);
    const rows = $$(".review-item").filter(r => r.querySelector(".item-check").checked);
    if (!rows.length) { toast("Nothing selected", "Check at least one action item to route.", "error"); return; }
    const bad = rows.find(r => !r.querySelector(".review-title").value.trim());
    if (bad) { toast("A task needs a title", "Give every selected item a short, clear action.", "error"); bad.querySelector(".review-title").focus(); return; }
    const disconnected = [...new Set(rows.map(r => r.querySelector(".item-dest").value).filter(t => !state.integrations[t].connected))];
    if (disconnected.length) {
      toast("Destination disconnected", `${disconnected.map(t => TOOL_META[t].name).join(", ")} ${disconnected.length === 1 ? "is" : "are"} switched off. Reconnect the tool or choose another destination.`, "error");
      return;
    }

    const groups = {};
    const owners = new Set();
    const routed = [];
    rows.forEach(row => {
      const a = m.actions.find(x => x.id === row.dataset.id);
      if (!a) return;
      a.title = row.querySelector(".review-title").value.trim();
      a.owner = row.querySelector(".item-owner").value;
      a.due = row.querySelector(".item-due").value;
      a.destination = row.querySelector(".item-dest").value;
      a.status = "routed";
      a.routeRef = nextRef(a.destination);
      groups[a.destination] = groups[a.destination] || [];
      groups[a.destination].push(a);
      owners.add(a.owner);
      routed.push(a);
    });
    m.status = m.actions.some(a => a.status === "review") ? "review" : "routed";
    state.routedTotal += routed.length;
    state.hoursSaved = +(state.hoursSaved + routed.length * .12).toFixed(1);
    state.activity.unshift({ actor: "maya", verb: "routed", count: routed.length, meeting: m.title.split("—")[0].trim(), tools: [...new Set(routed.map(a => a.destination))], time: "Just now" });
    renderAll();
    showSuccess(groups, owners, routed.length, m);
    toast(`${routed.length} tasks routed`, "Owners and destinations are up to date.");
  }

  function showSuccess(groups, owners, count, m) {
    const groupRows = Object.entries(groups).map(([tool, items]) => `<div class="success-tool">
      ${toolIcon(tool)}
      <div class="success-tool-copy"><b>${TOOL_META[tool].name}</b><span>${items[0].routeRef}${items.length > 1 ? ` + ${items.length - 1} more` : ""} · ${esc(state.integrations[tool].project)}</span></div>
      <span class="pill routed">${items.length} task${items.length === 1 ? "" : "s"}</span>
    </div>`).join("");
    openModal(`
      <div class="modal-shell success-shell">
        <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg></div>
        <p class="eyebrow">Handoff complete</p>
        <h2>${count} task${count === 1 ? " is" : "s are"} in motion.</h2>
        <p>Relay routed each item into ${listFormat(Object.keys(groups).map(t => TOOL_META[t].name))}. The owners are tagged, dated, and visible to the team.</p>
        <div class="success-tools">${groupRows}</div>
        <div class="owner-note"><div class="avatar-stack">${[...owners].slice(0, 4).map(o => personAvatar(o, "xs")).join("")}</div> ${owners.size} owner${owners.size === 1 ? "" : "s"} notified${owners.size > 4 ? ` +${owners.size - 4}` : ""}</div>
        <footer class="modal-foot">
          <button class="btn btn-ghost" data-close>Close</button>
          <button class="btn btn-primary" data-success-actions>View action items ${icon("arrow-right")}</button>
        </footer>
      </div>
    `, "success");
  }

  // ------------------------------------------------------------
  // Meeting detail
  // ------------------------------------------------------------
  function openMeeting(id) {
    const m = state.meetings.find(x => x.id === id);
    if (!m) return;
    openModal(`
      <div class="modal-shell detail-shell">
        ${modalCloseButton()}
        <div class="detail-head">
          <p class="eyebrow">${esc(m.source)} · ${esc(m.when)}</p>
          <h2>${esc(m.title)}</h2>
          <p>${esc(m.summary)}</p>
          <div class="avatar-stack">${m.participants.map(p => personAvatar(p)).join("")}</div>
          <div class="detail-meta">
            ${statusPill(m.status)}
            <span class="pill conf no-dot">${m.confidence}% confidence</span>
            <span class="pill no-dot">${esc(m.duration)}</span>
          </div>
        </div>
        <p class="section-label">Decisions</p>
        <div class="decision-list">${m.decisions.map(d => `<div class="decision-row">${icon("check")}<span>${esc(d)}</span></div>`).join("")}</div>
        <p class="section-label">Action items</p>
        <div class="detail-actions">
          ${m.actions.map(a => `<div class="detail-action">
            ${toolIcon(a.destination)}
            <div class="detail-action-copy"><b>${esc(a.title)}</b><span>${esc(personName(a.owner))} · ${fmtDay(a.due)} · ${esc(a.routeRef || "Not routed")}</span></div>
            ${personAvatar(a.owner)}
          </div>`).join("")}
        </div>
        <footer class="modal-foot">
          <button class="btn btn-ghost" data-close>Close</button>
          ${m.status === "review" ? `<button class="btn btn-primary" data-review="${m.id}">Review &amp; route ${icon("arrow-right")}</button>` : `<button class="btn btn-primary" data-close>Done</button>`}
        </footer>
      </div>
    `, "detail");
  }

  // ------------------------------------------------------------
  // Tool settings
  // ------------------------------------------------------------
  function openToolConfig(tool) {
    const meta = TOOL_META[tool], int = state.integrations[tool];
    openModal(`
      <div class="modal-shell config-shell">
        ${modalCloseButton()}
        <div class="config-head">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">${toolIcon(tool, "lg")}<span class="conn-state ${int.connected ? "" : "off"}"><i></i>${int.connected ? "Connected" : "Off"}</span></div>
          <h2>Configure ${meta.name}</h2>
          <p>Choose where Relay should send work by default. You can override this on any action item.</p>
        </div>
        <form id="toolForm">
          <div class="config-fields">
            <label class="field"><span>Workspace</span><input id="toolWorkspace" value="${escAttr(int.workspace)}"></label>
            <label class="field"><span>${meta.projectLabel}</span><input id="toolProject" value="${escAttr(int.project)}"></label>
          </div>
          <div class="config-row">
            <div><b>Create missing labels</b><small>Relay adds owner and priority labels when needed.</small></div>
            <button type="button" class="switch on" id="labelSwitch" role="switch" aria-checked="true"><span></span></button>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save changes</button>
          </footer>
        </form>
      </div>
    `, "config");
    $("#labelSwitch").addEventListener("click", e => {
      const el = e.currentTarget;
      const on = el.classList.toggle("on");
      el.setAttribute("aria-checked", String(on));
    });
    $("#toolForm").addEventListener("submit", e => {
      e.preventDefault();
      state.integrations[tool].workspace = $("#toolWorkspace").value.trim() || int.workspace;
      state.integrations[tool].project = $("#toolProject").value.trim() || int.project;
      state.integrations[tool].connected = true;
      closeModal();
      renderAll();
      toast(`${meta.name} updated`, `New items will use ${state.integrations[tool].project} by default.`);
    });
  }

  // ------------------------------------------------------------
  // Clipboard
  // ------------------------------------------------------------
  async function copyText(text, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast(label, "Ready to paste wherever you need it.");
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast(label, "Ready to paste wherever you need it.");
    }
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  function bindEvents() {
    $("#menuBtn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    $("#navScrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
    $("#searchBtn").addEventListener("click", openPalette);

    $("#palette").addEventListener("click", e => { if (e.target === $("#palette")) closePalette(); });
    $("#paletteInput").addEventListener("input", e => { paletteSel = 0; renderPalette(e.target.value); });
    $("#paletteResults").addEventListener("click", e => {
      const btn = e.target.closest("[data-palette-index]");
      if (btn) activatePaletteItem(paletteItems[Number(btn.dataset.paletteIndex)]);
    });

    $("#meetingFilters").addEventListener("click", e => {
      const btn = e.target.closest("[data-meeting-filter]");
      if (!btn) return;
      state.meetingFilter = btn.dataset.meetingFilter;
      renderMeetings();
    });
    $("#actionStatusFilters").addEventListener("click", e => {
      const btn = e.target.closest("[data-action-status]");
      if (!btn) return;
      state.actionFilter.status = btn.dataset.actionStatus;
      renderActions();
    });
    $("#actionSearch").addEventListener("input", e => { state.actionFilter.q = e.target.value; renderActions(); });
    $("#ownerFilter").addEventListener("change", e => { state.actionFilter.owner = e.target.value; renderActions(); });
    $("#toolFilter").addEventListener("change", e => { state.actionFilter.tool = e.target.value; renderActions(); });

    document.addEventListener("click", e => {
      const close = e.target.closest("[data-close]");
      if (close) { closeModal(); return; }

      const nav = e.target.closest("[data-page]");
      if (nav) { navigate(nav.dataset.page, { scroll: nav.dataset.scroll }); return; }
      const importTrigger = e.target.closest("[data-import]");
      if (importTrigger) { openImport(importTrigger.dataset.import === "upload" ? "upload" : "paste"); return; }
      if (e.target.closest("[data-new]")) { openImport(); return; }

      const review = e.target.closest("[data-review]");
      if (review) { openReview(review.dataset.review); return; }

      const done = e.target.closest("[data-done]");
      if (done) {
        const found = allActions().find(x => x.action.id === done.dataset.done);
        if (found) {
          const a = found.action;
          if (a.status === "done") { a.status = a.prevStatus || "routed"; }
          else { a.prevStatus = a.status; a.status = "done"; }
          renderAll();
          toast(a.status === "done" ? "Task complete" : "Task reopened", a.status === "done" ? "One less thing between you and the launch." : "It's back on the list.");
        }
        return;
      }

      const remove = e.target.closest("[data-remove]");
      if (remove) {
        const m = state.meetings.find(x => x.id === $("#modalCard").dataset.reviewMeeting);
        if (m) {
          syncDraft(m);
          m.actions = m.actions.filter(a => a.id !== remove.dataset.remove);
          $("#reviewItems").innerHTML = m.actions.map(a => reviewItemHTML(a)).join("");
          updateRouteSummary();
        }
        return;
      }

      const success = e.target.closest("[data-success-actions]");
      if (success) { closeModal(); navigate("actions"); return; }

      const toggleTool = e.target.closest("[data-toggle-tool]");
      if (toggleTool) {
        const tool = toggleTool.dataset.toggleTool;
        state.integrations[tool].connected = !state.integrations[tool].connected;
        renderAll();
        toast(TOOL_META[tool].name + (state.integrations[tool].connected ? " connected" : " disconnected"),
          state.integrations[tool].connected ? "Relay can route work here again." : "New tasks will skip this destination.");
        return;
      }

      const configure = e.target.closest("[data-configure]");
      if (configure) { openToolConfig(configure.dataset.configure); return; }

      const rule = e.target.closest("[data-rule]");
      if (rule) {
        const r = state.rules.find(x => x.id === rule.dataset.rule);
        if (r) { r.on = !r.on; renderIntegrations(); toast("Rule " + (r.on ? "enabled" : "paused"), r.when + "."); }
        return;
      }

      const addRule = e.target.closest("[data-add-rule]");
      if (addRule) {
        const next = Object.entries(RULE_POOL).find(([id]) => !state.rules.some(r => r.id === id));
        if (next) {
          state.rules.push({ id: next[0], on: true, ...next[1] });
          renderIntegrations();
          toast("Rule added", next[1].when + ".");
        } else {
          toast("All demo rules are active", "The full build supports custom conditions.", "error");
        }
        return;
      }

      if (e.target.closest("[data-copy-endpoint]")) { copyText("POST https://api.relay.app/v1/meetings/ingest", "Endpoint copied"); return; }

      if (e.target.closest("[data-test-webhook]")) {
        $("#lastDelivery").textContent = "Last delivery: 200 OK · just now";
        state.activity.unshift({ actor: null, verb: "delivered a test webhook for", count: 1, meeting: "Developer API", tools: ["jira"], time: "Just now" });
        renderOverview();
        toast("Test event delivered", "200 OK · 184 ms · 3 actions parsed.");
        return;
      }

      const meetingRow = e.target.closest("[data-meeting]");
      if (meetingRow) { openMeeting(meetingRow.dataset.meeting); return; }

      if (e.target.closest("[data-toast-workspace]")) toast("Northwind workspace", "Team plan · 6 members · billing is handled by Amara.");
      if (e.target.closest("[data-toast-profile]")) toast("Maya Chen", "Product lead · Northwind. Demo profile settings are local only.");
      if (e.target.closest("[data-toast-notifications]")) {
        const waiting = state.meetings.filter(m => m.status === "review").length;
        toast("You're all caught up", `No new notifications. ${waiting} meeting${waiting === 1 ? "" : "s"} waiting for review.`);
      }
      if (e.target.closest("[data-toast-join]")) toast("Opening Google Meet", "The design critique starts at 2:00 PM.");
      if (e.target.closest("[data-toast-activity]")) toast("Activity log", "Showing the latest handoffs from the last 7 days.");
      if (e.target.closest("[data-toast-filter]")) toast("Source filter", "Zoom, Meet, and Fireflies are all included in this demo.");
      if (e.target.closest("[data-toast-browse]")) toast("Integration directory", "Notion, Jira, Trello and Slack are ready to connect.");
      if (e.target.closest("[data-snooze]")) toast("Snoozed for an hour", "We'll nudge you before the next sync.");
    });

    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
      if (e.key === "Escape") {
        if ($("#palette").classList.contains("open")) { closePalette(); return; }
        if ($("#modal").classList.contains("open")) { closeModal(); return; }
        document.body.classList.remove("nav-open");
        return;
      }
      if ($("#palette").classList.contains("open")) {
        if (e.key === "ArrowDown") { e.preventDefault(); paletteSel = Math.min(paletteSel + 1, paletteItems.length - 1); renderPalette($("#paletteInput").value); }
        if (e.key === "ArrowUp") { e.preventDefault(); paletteSel = Math.max(paletteSel - 1, 0); renderPalette($("#paletteInput").value); }
        if (e.key === "Enter") { e.preventDefault(); activatePaletteItem(paletteItems[paletteSel]); }
      }
    });

    $("#modal").addEventListener("click", e => { if (e.target === $("#modal")) closeModal(); });

    document.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const row = e.target.closest("tr[data-meeting]") || e.target.closest(".action-item[data-meeting]");
        if (row && !e.target.closest("button,input,select,textarea")) openMeeting(row.dataset.meeting);
      }
    });

    window.addEventListener("hashchange", () => {
      const page = location.hash.replace("#", "");
      if (PAGE_NAMES[page] && page !== state.page) navigate(page, { fromHash: true });
    });
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  seed();
  renderAll();
  bindEvents();
  const initial = location.hash.replace("#", "");
  if (PAGE_NAMES[initial]) navigate(initial, { fromHash: true, instant: true });
  else navigate("overview", { fromHash: true, instant: true });

  const params = new URLSearchParams(location.search);
  if (params.get("review")) setTimeout(() => openReview(params.get("review")), 250);
  if (params.get("import")) setTimeout(() => openImport(params.get("import") === "upload" ? "upload" : "paste"), 250);
})();
