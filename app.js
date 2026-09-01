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

const UKEDAGER = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

let supabaseClient = null;

function formatDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${UKEDAGER[d.getDay()]} ${d.getDate()}. ${MANEDER[d.getMonth()]} ${d.getFullYear()}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getIdentity() {
  return {
    barnehage: localStorage.getItem("nettverkstavla_barnehage") || BARNEHAGER[0],
    name: localStorage.getItem("nettverkstavla_navn") || "",
  };
}

function setupIdentity() {
  const select = document.getElementById("barnehageSelect");
  BARNEHAGER.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });

  const tagsList = document.getElementById("barnehageTags");
  BARNEHAGER.forEach((b) => {
    const li = document.createElement("li");
    li.textContent = b;
    tagsList.appendChild(li);
  });

  const identity = getIdentity();
  select.value = identity.barnehage;
  document.getElementById("nameInput").value = identity.name;

  select.addEventListener("change", () => {
    localStorage.setItem("nettverkstavla_barnehage", select.value);
    renderProposals(cachedProposals);
  });
  document.getElementById("nameInput").addEventListener("change", (e) => {
    localStorage.setItem("nettverkstavla_navn", e.target.value.trim());
  });
}

function setupToggle(buttonId, formId) {
  const btn = document.getElementById(buttonId);
  const form = document.getElementById(formId);
  btn.addEventListener("click", () => {
    form.hidden = !form.hidden;
    btn.textContent = form.hidden ? btn.dataset.openLabel : "Avbryt";
  });
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

    node.querySelector(".card-date").textContent = formatDateLong(meeting.date);
    node.querySelector(".card-title").textContent = meeting.title;

    const metaParts = [];
    if (meeting.time) metaParts.push(meeting.time);
    if (meeting.location) metaParts.push(meeting.location);
    node.querySelector(".card-meta").textContent = metaParts.join(" · ");

    node.querySelector(".card-note").textContent = meeting.note || "";

    node.querySelector(".card-remove").addEventListener("click", async () => {
      if (!confirm(`Fjerne "${meeting.title}"?`)) return;
      await supabaseClient.from("network_meetings").delete().eq("id", meeting.id);
      loadMeetings();
    });

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
      const hasVoted = votes.some((v) => v.barnehage === identity.barnehage);

      let dateLabel = formatDateLong(option.date);
      if (option.time) dateLabel += ` · ${option.time}`;
      optionNode.querySelector(".option-date").textContent = dateLabel;

      const votesEl = optionNode.querySelector(".option-votes");
      if (votes.length === 0) {
        const span = document.createElement("span");
        span.className = "vote-chip is-empty";
        span.textContent = "Ingen har stemt ennå";
        votesEl.appendChild(span);
      } else {
        votes.forEach((v) => {
          const chip = document.createElement("span");
          chip.className = "vote-chip";
          chip.textContent = v.barnehage;
          votesEl.appendChild(chip);
        });
      }

      const voteBtn = optionNode.querySelector(".vote-btn");
      voteBtn.textContent = hasVoted ? "Vi kan ✓" : "Vi kan";
      voteBtn.classList.toggle("is-voted", hasVoted);
      voteBtn.addEventListener("click", () => toggleVote(option.id, identity, hasVoted));

      optionNode.querySelector(".lock-btn").addEventListener("click", () => lockOption(proposal, option));

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

async function toggleVote(optionId, identity, hasVoted) {
  if (hasVoted) {
    await supabaseClient
      .from("date_votes")
      .delete()
      .eq("option_id", optionId)
      .eq("barnehage", identity.barnehage);
  } else {
    await supabaseClient.from("date_votes").insert({
      option_id: optionId,
      barnehage: identity.barnehage,
      name: identity.name || null,
    });
  }
  loadProposals();
}

async function lockOption(proposal, option) {
  let dateLabel = formatDateLong(option.date);
  if (!confirm(`Låse "${proposal.title}" til ${dateLabel}? Dette legger den til som avtalt dato og lukker forslaget.`)) return;

  const identity = getIdentity();
  const { error: insertError } = await supabaseClient.from("network_meetings").insert({
    title: proposal.title,
    date: option.date,
    time: option.time,
    note: proposal.description || null,
    created_by: identity.barnehage,
  });
  if (insertError) {
    alert("Klarte ikke å låse datoen. Prøv igjen.");
    return;
  }

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
  setupToggle("toggleAddMeeting", "addMeetingForm");
  setupToggle("toggleAddProposal", "addProposalForm");
  setupIdentity();

  if (showConfigWarningIfNeeded()) return;

  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  loadMeetings();
  loadProposals();
}

init();
