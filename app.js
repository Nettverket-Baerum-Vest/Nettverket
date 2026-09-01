const BARNEHAGER = [
  "Kirkerudbakken",
  "Kolsåstrollet",
  "Ekrekroken",
  "Sollia",
  "Oddenskogen",
  "Epleskogen",
  "Gjettum",
  "Berghoff",
  "Grindaberget",
];

// Faste kontaktpersoner per barnehage. Fylles ut automatisk i navnefeltet
// når barnehagen velges (kan alltid overstyres, f.eks. ved vikar).
const BARNEHAGE_DEFAULT_NAMES = {
  "Kirkerudbakken": "Benjamin",
  "Kolsåstrollet": "Hilde",
  "Ekrekroken": "Cathrine Po",
  "Sollia": "Karin",
  "Oddenskogen": "Vibeke",
  "Epleskogen": "Ola",
  "Gjettum": "Cathrine Pe",
  "Berghoff": "Ivan",
  "Grindaberget": "Jenny",
};

const UKEDAGER = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

let supabaseClient = null;

function slug(name) {
  return name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "");
}

function bhColorVar(name) {
  return `var(--bh-${slug(name)})`;
}

function bhBadge(name, label) {
  const span = document.createElement("span");
  span.className = "bh-badge";
  span.style.setProperty("--bh-color", bhColorVar(name));
  span.textContent = label ? `${label}: ${name}` : name;
  return span;
}

function nextBarnehage(current) {
  const idx = BARNEHAGER.indexOf(current);
  if (idx === -1) return BARNEHAGER[0];
  return BARNEHAGER[(idx + 1) % BARNEHAGER.length];
}

function fillBarnehageSelect(select, includeEmpty) {
  if (includeEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Ikke satt";
    select.appendChild(opt);
  }
  BARNEHAGER.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });
}

function applyBhColor(element, name) {
  element.style.setProperty("--bh-color", bhColorVar(name));
}

function setYouColor(barnehage) {
  document.documentElement.style.setProperty("--you", bhColorVar(barnehage));
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${UKEDAGER[d.getDay()]} ${d.getDate()}. ${MANEDER[d.getMonth()]} ${d.getFullYear()}`;
}

function icsEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function downloadIcs(meeting) {
  const pad = (n) => String(n).padStart(2, "0");
  const [y, m, d] = meeting.date.split("-").map(Number);
  const start = `${y}${pad(m)}${pad(d)}`;
  const endDate = new Date(y, m - 1, d + 1);
  const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}`;

  const descParts = [];
  if (meeting.time) descParts.push(`Tidspunkt: ${meeting.time}`);
  if (meeting.moteleder) descParts.push(`Møteleder: ${meeting.moteleder}`);
  if (meeting.referent) descParts.push(`Referent: ${meeting.referent}`);
  if (meeting.note) descParts.push(meeting.note);

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nettverkstavla//NO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@nettverkstavla`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(meeting.title)}`,
    meeting.location ? `LOCATION:${icsEscape(meeting.location)}` : null,
    descParts.length ? `DESCRIPTION:${icsEscape(descParts.join("\n"))}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(meeting.title) || "motedato"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getStoredName(barnehage) {
  return localStorage.getItem(`nettverkstavla_navn_${slug(barnehage)}`);
}
function setStoredName(barnehage, name) {
  localStorage.setItem(`nettverkstavla_navn_${slug(barnehage)}`, name);
}

function getIdentity() {
  const barnehage = localStorage.getItem("nettverkstavla_barnehage") || BARNEHAGER[0];
  const stored = getStoredName(barnehage);
  const name = stored !== null ? stored : (BARNEHAGE_DEFAULT_NAMES[barnehage] || "");
  return { barnehage, name };
}

function setupIdentity() {
  const select = document.getElementById("barnehageSelect");
  fillBarnehageSelect(select, false);
  fillBarnehageSelect(document.getElementById("meetingModerator"), true);
  fillBarnehageSelect(document.getElementById("meetingReferent"), true);

  const tagsList = document.getElementById("barnehageTags");
  BARNEHAGER.forEach((b) => {
    const li = document.createElement("li");
    li.textContent = b;
    li.style.setProperty("--bh-color", `var(--bhfix-${slug(b)})`);
    tagsList.appendChild(li);
  });

  const identity = getIdentity();
  select.value = identity.barnehage;
  document.getElementById("nameInput").value = identity.name;
  setYouColor(identity.barnehage);

  select.addEventListener("change", () => {
    localStorage.setItem("nettverkstavla_barnehage", select.value);
    const updated = getIdentity();
    document.getElementById("nameInput").value = updated.name;
    setYouColor(updated.barnehage);
    renderProposals(cachedProposals);
  });
  document.getElementById("nameInput").addEventListener("change", (e) => {
    setStoredName(getIdentity().barnehage, e.target.value.trim());
  });
}

function setupToggle(buttonId, formId, onOpen) {
  const btn = document.getElementById(buttonId);
  const form = document.getElementById(formId);
  btn.addEventListener("click", () => {
    form.hidden = !form.hidden;
    btn.textContent = form.hidden ? btn.dataset.openLabel : "Avbryt";
    if (!form.hidden && onOpen) onOpen();
  });
}

function suggestRotation() {
  const last = cachedMeetings.length ? cachedMeetings[cachedMeetings.length - 1] : null;
  const suggestedModerator = last && last.referent ? last.referent : "";
  const suggestedReferent = last && last.referent ? nextBarnehage(last.referent) : "";
  document.getElementById("meetingModerator").value = suggestedModerator;
  document.getElementById("meetingReferent").value = suggestedReferent;
}

document.addEventListener("click", (e) => {
  const cancelId = e.target.dataset.cancel;
  if (cancelId) {
    const form = document.getElementById(cancelId);
    form.hidden = true;
    form.reset();
    const openBtn = document.querySelector(`[data-cancel="${cancelId}"]`).closest("section").querySelector(".ghost-btn");
    if (openBtn) openBtn.textContent = openBtn.dataset.openLabel;
  }
});

/* ---------------- Meetings ---------------- */

let cachedMeetings = [];

async function loadMeetings() {
  const { data, error } = await supabaseClient
    .from("network_meetings")
    .select("*")
    .order("date", { ascending: true });

  const list = document.getElementById("meetingsList");
  list.innerHTML = "";

  if (error) {
    list.innerHTML = `<p class="empty-state">Klarte ikke å hente datoer. Prøv å laste siden på nytt.</p>`;
    return;
  }

  cachedMeetings = data || [];

  if (!data || data.length === 0) {
    list.innerHTML = `<p class="empty-state">Ingen avtalte datoer ennå.</p>`;
    return;
  }

  const today = todayStr();
  const template = document.getElementById("meetingCardTemplate");

  data.forEach((meeting) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".meeting-card");
    if (meeting.date < today) card.classList.add("is-past");
    const pinColor = meeting.moteleder || meeting.referent;
    if (pinColor) applyBhColor(card, pinColor);

    node.querySelector(".card-date").textContent = formatDateLong(meeting.date);
    node.querySelector(".card-title").textContent = meeting.title;

    const metaParts = [];
    if (meeting.time) metaParts.push(meeting.time);
    if (meeting.location) metaParts.push(meeting.location);
    node.querySelector(".card-meta").textContent = metaParts.join(" · ");

    node.querySelector(".card-note").textContent = meeting.note || "";

    const badgeRow = node.querySelector(".card-badge-row");
    if (meeting.moteleder) badgeRow.appendChild(bhBadge(meeting.moteleder, "Møteleder"));
    if (meeting.referent) badgeRow.appendChild(bhBadge(meeting.referent, "Referent"));

    const attendanceEl = node.querySelector(".card-attendance");
    if (meeting.attending && meeting.attending.length) {
      const line = document.createElement("div");
      line.className = "attendance-line";
      const label = document.createElement("span");
      label.className = "attendance-label";
      label.textContent = "Deltar:";
      line.appendChild(label);
      meeting.attending.forEach((b) => {
        const chip = document.createElement("span");
        chip.className = "vote-chip";
        chip.style.setProperty("--bh-color", bhColorVar(b));
        chip.textContent = b;
        line.appendChild(chip);
      });
      attendanceEl.appendChild(line);
    }
    if (meeting.not_attending && meeting.not_attending.length) {
      const line = document.createElement("div");
      line.className = "attendance-line";
      const label = document.createElement("span");
      label.className = "attendance-label";
      label.textContent = "Kan ikke:";
      line.appendChild(label);
      meeting.not_attending.forEach((b) => {
        const chip = document.createElement("span");
        chip.className = "vote-chip is-no";
        chip.textContent = b;
        line.appendChild(chip);
      });
      attendanceEl.appendChild(line);
    }

    node.querySelector(".card-remove").addEventListener("click", async () => {
      if (!confirm(`Fjerne "${meeting.title}"?`)) return;
      await supabaseClient.from("network_meetings").delete().eq("id", meeting.id);
      loadMeetings();
    });

    node.querySelector(".add-to-calendar").addEventListener("click", () => downloadIcs(meeting));

    list.appendChild(node);
  });
}

document.getElementById("addMeetingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const identity = getIdentity();
  const payload = {
    title: document.getElementById("meetingTitle").value.trim(),
    date: document.getElementById("meetingDate").value,
    time: document.getElementById("meetingTime").value.trim() || null,
    location: document.getElementById("meetingLocation").value.trim() || null,
    note: document.getElementById("meetingNote").value.trim() || null,
    created_by: identity.barnehage,
    moteleder: document.getElementById("meetingModerator").value || null,
    referent: document.getElementById("meetingReferent").value || null,
  };
  const { error } = await supabaseClient.from("network_meetings").insert(payload);
  if (error) {
    alert("Klarte ikke å lagre datoen. Prøv igjen.");
    return;
  }
  e.target.reset();
  e.target.hidden = true;
  document.getElementById("toggleAddMeeting").textContent = "+ Legg til dato";
  loadMeetings();
});

/* ---------------- Proposals ---------------- */

let cachedProposals = [];

async function loadProposals() {
  const { data, error } = await supabaseClient
    .from("date_proposals")
    .select("*, date_options(*, date_votes(*))")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const list = document.getElementById("proposalsList");

  if (error) {
    list.innerHTML = `<p class="empty-state">Klarte ikke å hente forslag. Prøv å laste siden på nytt.</p>`;
    return;
  }

  cachedProposals = data || [];
  renderProposals(cachedProposals);
}

function renderProposals(proposals) {
  const list = document.getElementById("proposalsList");
  list.innerHTML = "";

  if (!proposals || proposals.length === 0) {
    list.innerHTML = `<p class="empty-state">Ingen åpne forslag ennå. Opprett ett over.</p>`;
    return;
  }

  const identity = getIdentity();
  const proposalTemplate = document.getElementById("proposalCardTemplate");
  const optionTemplate = document.getElementById("optionRowTemplate");

  proposals.forEach((proposal) => {
    const node = proposalTemplate.content.cloneNode(true);
    node.querySelector(".proposal-title").textContent = proposal.title;
    node.querySelector(".proposal-description").textContent = proposal.description || "";
    if (proposal.created_by) {
      node.querySelector(".card-badge-row").appendChild(bhBadge(proposal.created_by, "Foreslått av"));
    }

    node.querySelector(".card-remove").addEventListener("click", async () => {
      if (!confirm(`Fjerne forslaget "${proposal.title}" og alle datoene i det?`)) return;
      await supabaseClient.from("date_proposals").delete().eq("id", proposal.id);
      loadProposals();
    });

    const optionList = node.querySelector(".option-list");
    const options = [...(proposal.date_options || [])].sort((a, b) => a.date.localeCompare(b.date));

    if (options.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Ingen datoforslag ennå.";
      optionList.appendChild(empty);
    }

    options.forEach((option) => {
      const optionNode = optionTemplate.content.cloneNode(true);
      const votes = option.date_votes || [];
      const yesVotes = votes.filter((v) => v.can_attend);
      const noVotes = votes.filter((v) => !v.can_attend);
      const myVote = votes.find((v) => v.barnehage === identity.barnehage);

      let dateLabel = formatDateLong(option.date);
      if (option.time) dateLabel += ` · ${option.time}`;
      optionNode.querySelector(".option-date").textContent = dateLabel;

      const votesEl = optionNode.querySelector(".option-votes");
      if (yesVotes.length === 0) {
        const span = document.createElement("span");
        span.className = "vote-chip is-empty";
        span.textContent = "Ingen har stemt ennå";
        votesEl.appendChild(span);
      } else {
        yesVotes.forEach((v) => {
          const chip = document.createElement("span");
          chip.className = "vote-chip";
          chip.style.setProperty("--bh-color", bhColorVar(v.barnehage));
          chip.textContent = v.barnehage;
          votesEl.appendChild(chip);
        });
      }

      const noVotesEl = optionNode.querySelector(".option-votes-no");
      noVotes.forEach((v) => {
        const chip = document.createElement("span");
        chip.className = "vote-chip is-no";
        chip.textContent = v.barnehage;
        noVotesEl.appendChild(chip);
      });

      const yesBtn = optionNode.querySelector(".vote-yes");
      const noBtn = optionNode.querySelector(".vote-no");
      const votedYes = !!myVote && myVote.can_attend;
      const votedNo = !!myVote && !myVote.can_attend;
      yesBtn.textContent = votedYes ? "Vi kan ✓" : "Vi kan";
      yesBtn.classList.toggle("is-voted", votedYes);
      noBtn.textContent = votedNo ? "Vi kan ikke ✓" : "Vi kan ikke";
      noBtn.classList.toggle("is-voted", votedNo);
      yesBtn.addEventListener("click", () => setVote(option.id, identity, true, votedYes));
      noBtn.addEventListener("click", () => setVote(option.id, identity, false, votedNo));

      optionNode.querySelector(".lock-btn").addEventListener("click", (e) => lockOption(proposal, option, e));

      optionNode.querySelector(".option-remove").addEventListener("click", async () => {
        if (!confirm("Fjerne dette datoforslaget?")) return;
        await supabaseClient.from("date_options").delete().eq("id", option.id);
        loadProposals();
      });

      optionList.appendChild(optionNode);
    });

    const addOptionToggle = node.querySelector(".add-option-toggle");
    const addOptionForm = node.querySelector(".add-option-form");
    addOptionToggle.addEventListener("click", () => {
      addOptionForm.hidden = !addOptionForm.hidden;
      addOptionToggle.hidden = !addOptionForm.hidden;
    });
    addOptionForm.querySelector("[data-cancel-option]").addEventListener("click", () => {
      addOptionForm.hidden = true;
      addOptionToggle.hidden = false;
      addOptionForm.reset();
    });
    addOptionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        proposal_id: proposal.id,
        date: addOptionForm.querySelector(".option-date").value,
        time: addOptionForm.querySelector(".option-time").value.trim() || null,
        created_by: identity.barnehage,
      };
      const { error } = await supabaseClient.from("date_options").insert(payload);
      if (error) {
        alert("Klarte ikke å legge til datoen. Prøv igjen.");
        return;
      }
      loadProposals();
    });

    list.appendChild(node);
  });
}

async function setVote(optionId, identity, attending, alreadySetToThis) {
  let error;
  if (alreadySetToThis) {
    ({ error } = await supabaseClient
      .from("date_votes")
      .delete()
      .eq("option_id", optionId)
      .eq("barnehage", identity.barnehage));
  } else {
    ({ error } = await supabaseClient.from("date_votes").upsert(
      {
        option_id: optionId,
        barnehage: identity.barnehage,
        can_attend: attending,
        name: identity.name || null,
      },
      { onConflict: "option_id,barnehage" }
    ));
  }
  if (error) {
    alert("Klarte ikke å registrere stemmen. Prøv igjen.");
    return;
  }
  loadProposals();
}

function fireConfetti(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const slugs = BARNEHAGER.map(slug);
  const container = document.createElement("div");
  container.className = "confetti-burst";
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "confetti-dot";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 55 + Math.random() * 55;
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    dot.style.setProperty("--rot", `${Math.round(Math.random() * 360)}deg`);
    dot.style.setProperty("--dot-color", `var(--bh-${slugs[i % slugs.length]})`);
    dot.style.animationDelay = `${(Math.random() * 0.08).toFixed(2)}s`;
    container.appendChild(dot);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 900);
}

function playFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 — a quick "ta-da"
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      const dur = 0.22;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (e) {
    // lyd er ikke støttet eller blokkert av nettleseren — konfettien er nok
  }
}

async function lockOption(proposal, option, clickEvent) {
  let dateLabel = formatDateLong(option.date);
  if (!confirm(`Låse "${proposal.title}" til ${dateLabel}? Dette legger den til som avtalt dato og lukker forslaget.`)) return;

  const identity = getIdentity();
  const votes = option.date_votes || [];
  const lastMeeting = cachedMeetings.length ? cachedMeetings[cachedMeetings.length - 1] : null;
  const moteleder = lastMeeting && lastMeeting.referent ? lastMeeting.referent : null;
  const referent = lastMeeting && lastMeeting.referent ? nextBarnehage(lastMeeting.referent) : null;

  const { error: insertError } = await supabaseClient.from("network_meetings").insert({
    title: proposal.title,
    date: option.date,
    time: option.time,
    note: proposal.description || null,
    created_by: identity.barnehage,
    moteleder,
    referent,
    attending: votes.filter((v) => v.can_attend).map((v) => v.barnehage),
    not_attending: votes.filter((v) => !v.can_attend).map((v) => v.barnehage),
  });
  if (insertError) {
    alert("Klarte ikke å låse datoen. Prøv igjen.");
    return;
  }

  if (clickEvent) fireConfetti(clickEvent.clientX, clickEvent.clientY);
  playFanfare();
  await supabaseClient.from("date_proposals").update({ status: "closed" }).eq("id", proposal.id);
  loadMeetings();
  loadProposals();
}

document.getElementById("addProposalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const identity = getIdentity();
  const payload = {
    title: document.getElementById("proposalTitle").value.trim(),
    description: document.getElementById("proposalDescription").value.trim() || null,
    created_by: identity.barnehage,
  };
  const { error } = await supabaseClient.from("date_proposals").insert(payload);
  if (error) {
    alert("Klarte ikke å opprette forslaget. Prøv igjen.");
    return;
  }
  e.target.reset();
  e.target.hidden = true;
  document.getElementById("toggleAddProposal").textContent = "+ Nytt forslag";
  loadProposals();
});

/* ---------------- Boot ---------------- */

function showConfigWarningIfNeeded() {
  if (SUPABASE_URL.startsWith("SETT_INN") || SUPABASE_KEY.startsWith("SETT_INN")) {
    const banner = document.createElement("div");
    banner.className = "config-warning";
    banner.textContent = "Siden er ikke koblet til en database ennå — fyll inn SUPABASE_URL og SUPABASE_KEY i config.js.";
    document.body.prepend(banner);
    return true;
  }
  return false;
}

function init() {
  document.getElementById("toggleAddMeeting").dataset.openLabel = "+ Legg til dato";
  document.getElementById("toggleAddProposal").dataset.openLabel = "+ Nytt forslag";
  setupToggle("toggleAddMeeting", "addMeetingForm", suggestRotation);
  setupToggle("toggleAddProposal", "addProposalForm");
  setupIdentity();

  if (showConfigWarningIfNeeded()) return;

  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  loadMeetings();
  loadProposals();
}

init();
