const PEOPLE = {
  anka: { label: "Anka", quota: 5 },
  gabel: { label: "Gabel", quota: 3 },
};

const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const config = window.LUCALENDER_CONFIG || {};
const apiUrl = config.supabaseUrl ? `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/bookings` : "";

const state = {
  viewDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: null,
  bookings: {},
  online: false,
};

const elements = {
  grid: document.querySelector("#calendarGrid"),
  monthTitle: document.querySelector("#monthTitle"),
  quotaMonth: document.querySelector("#quotaMonth"),
  quotaList: document.querySelector("#quotaList"),
  dialog: document.querySelector("#bookingDialog"),
  form: document.querySelector("#bookingForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogDate: document.querySelector("#dialogDate"),
  dialogMessage: document.querySelector("#dialogMessage"),
  bookingNote: document.querySelector("#bookingNote"),
  deleteButton: document.querySelector("#deleteBooking"),
  saveButton: document.querySelector("#saveBooking"),
  connectionStatus: document.querySelector("#connectionStatus"),
  toast: document.querySelector("#toast"),
};

function apiHeaders(extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function fetchBookings({ quiet = false } = {}) {
  if (!apiUrl || !config.supabaseAnonKey) {
    setConnection(false, "Online-Speicher noch nicht verbunden");
    render();
    return;
  }

  try {
    const response = await fetch(`${apiUrl}?select=booking_date,person,note&order=booking_date.asc`, {
      headers: apiHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Abruf fehlgeschlagen (${response.status})`);
    const rows = await response.json();
    state.bookings = Object.fromEntries(rows.map((row) => [row.booking_date, { person: row.person, note: row.note || "" }]));
    setConnection(true, "Gemeinsamer Plan ist live");
    render();
  } catch (error) {
    setConnection(false, "Verbindung unterbrochen");
    if (!quiet) showToast("Der gemeinsame Plan ist gerade nicht erreichbar.");
  }
}

async function createBooking(key, booking) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: apiHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ booking_date: key, ...booking }),
  });
  if (response.status === 409) throw new Error("Dieser Tag wurde gerade schon gebucht.");
  if (!response.ok) throw new Error(await readApiError(response));
}

async function updateBooking(key, booking) {
  const response = await fetch(`${apiUrl}?booking_date=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: apiHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(booking),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

async function removeBooking(key) {
  const response = await fetch(`${apiUrl}?booking_date=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: apiHeaders({ Prefer: "return=minimal" }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

async function readApiError(response) {
  try {
    const body = await response.json();
    if (body.message?.includes("Kontingent")) return body.message;
  } catch (error) {
    // The status below remains useful when the API sends no JSON body.
  }
  return `Speichern fehlgeschlagen (${response.status}).`;
}

function setConnection(online, label) {
  state.online = online;
  elements.connectionStatus.classList.toggle("offline", !online);
  elements.connectionStatus.lastChild.textContent = ` ${label}`;
}

function keyFor(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthUsage(person, viewDate = state.viewDate) {
  const prefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;
  return Object.entries(state.bookings).filter(([date, booking]) => date.startsWith(prefix) && booking.person === person).length;
}

function render() {
  renderCalendar();
  renderQuotas();
}

function renderCalendar() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const title = capitalize(monthFormatter.format(state.viewDate));
  elements.monthTitle.textContent = title;
  elements.quotaMonth.textContent = title;
  elements.grid.replaceChildren();

  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const today = new Date();

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = keyFor(date);
    const booking = state.bookings[key];
    const button = document.createElement("button");
    const outside = date.getMonth() !== month;
    button.type = "button";
    button.className = `day-cell${outside ? " outside" : ""}${sameDate(date, today) ? " today" : ""}${booking ? ` booked ${booking.person}` : ""}`;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", booking
      ? `${dateFormatter.format(date)}, gebucht von ${PEOPLE[booking.person].label}${booking.note ? `: ${booking.note}` : ""}`
      : `${dateFormatter.format(date)}, frei`);
    button.innerHTML = `<span class="day-number">${date.getDate()}</span>${booking
      ? `<span class="booking-pin" aria-hidden="true"></span><strong class="booking-person">${PEOPLE[booking.person].label}</strong><span class="booking-note">${escapeHtml(booking.note || "Luca gesichert")}</span>`
      : ""}`;
    button.addEventListener("click", () => openBooking(date));
    elements.grid.append(button);
  }
}

function renderQuotas() {
  elements.quotaList.replaceChildren();
  Object.entries(PEOPLE).forEach(([key, person]) => {
    const used = monthUsage(key);
    const remaining = Math.max(0, person.quota - used);
    const row = document.createElement("div");
    row.className = `quota-row ${key}`;
    row.innerHTML = `
      <span class="quota-name"><i></i>${person.label}</span>
      <span class="quota-track" aria-label="${used} von ${person.quota} genutzt"><span class="quota-fill" style="width:${Math.min(100, (used / person.quota) * 100)}%"></span></span>
      <span class="quota-count">${remaining}/${person.quota}</span>`;
    elements.quotaList.append(row);
  });
}

function openBooking(date) {
  if (!state.online) {
    showToast("Die Online-Vergabestelle ist noch nicht verbunden.");
    return;
  }
  state.selectedDate = new Date(date);
  const booking = state.bookings[keyFor(date)];
  elements.dialogDate.textContent = capitalize(dateFormatter.format(date));
  elements.dialogMessage.textContent = "";
  elements.dialogTitle.textContent = booking ? "Buchung prüfen" : "Luca beantragen";
  elements.saveButton.textContent = booking ? "Änderung speichern" : "Verbindlich buchen";
  elements.deleteButton.classList.toggle("is-hidden", !booking);
  elements.bookingNote.value = booking?.note || "";
  const selectedPerson = booking?.person || "anka";
  elements.form.querySelector(`input[name="person"][value="${selectedPerson}"]`).checked = true;
  elements.dialog.showModal();
  requestAnimationFrame(() => elements.bookingNote.focus());
}

function closeDialog() {
  elements.dialog.close();
  state.selectedDate = null;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!state.selectedDate || !state.online) return;
  const selectedDate = new Date(state.selectedDate);
  const key = keyFor(selectedDate);
  const oldBooking = state.bookings[key];
  const data = new FormData(elements.form);
  const person = data.get("person");
  const used = monthUsage(person, selectedDate);
  const alreadyCounted = oldBooking?.person === person;

  if (!alreadyCounted && used >= PEOPLE[person].quota) {
    elements.dialogMessage.textContent = `${PEOPLE[person].label}s Kontingent ist für diesen Monat bereits aufgebraucht.`;
    return;
  }

  const booking = { person, note: String(data.get("note") || "").trim() };
  setBusy(true);
  try {
    if (oldBooking) await updateBooking(key, booking);
    else await createBooking(key, booking);
    closeDialog();
    state.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    await fetchBookings({ quiet: true });
    showToast(`Luca wurde für ${PEOPLE[person].label} reserviert.`);
  } catch (error) {
    elements.dialogMessage.textContent = error.message;
    await fetchBookings({ quiet: true });
  } finally {
    setBusy(false);
  }
}

async function deleteBooking() {
  if (!state.selectedDate || !state.online) return;
  const key = keyFor(state.selectedDate);
  setBusy(true);
  try {
    await removeBooking(key);
    closeDialog();
    await fetchBookings({ quiet: true });
    showToast("Luca ist an diesem Tag wieder Freiwild.");
  } catch (error) {
    elements.dialogMessage.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  elements.saveButton.disabled = busy;
  elements.deleteButton.disabled = busy;
  if (busy) {
    elements.saveButton.textContent = "Wird gestempelt …";
  } else if (state.selectedDate) {
    elements.saveButton.textContent = state.bookings[keyFor(state.selectedDate)] ? "Änderung speichern" : "Verbindlich buchen";
  }
}

async function sharePlan() {
  const url = `${window.location.origin}${window.location.pathname}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Live-Link kopiert — ab in den Gruppenchat.");
  } catch (error) {
    window.prompt("Diesen Live-Link kopieren:", url);
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2700);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

document.querySelector("#prevMonth").addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() - 1);
  render();
});
document.querySelector("#nextMonth").addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() + 1);
  render();
});
document.querySelector("#todayButton").addEventListener("click", () => {
  const today = new Date();
  state.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  render();
});
document.querySelector("#shareButton").addEventListener("click", sharePlan);
document.querySelector("#dialogClose").addEventListener("click", closeDialog);
elements.deleteButton.addEventListener("click", deleteBooking);
elements.form.addEventListener("submit", handleSubmit);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

render();
fetchBookings();
setInterval(() => {
  if (document.visibilityState === "visible" && !elements.dialog.open) fetchBookings({ quiet: true });
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") fetchBookings({ quiet: true });
});
