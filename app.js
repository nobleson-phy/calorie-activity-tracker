// FitTrack - offline calorie & activity tracker
// All data is stored locally in the browser (localStorage). No network calls.

(function () {
  "use strict";

  const KCAL_PER_KG = 7700;
  const LS = {
    PROFILE: "ct_profile",
    DAYS: "ct_days",
    MYFOODS: "ct_myfoods",
    WEIGHTLOG: "ct_weightlog",
    NOTIF: "ct_notif",
    DISMISSED: "ct_dismissed",
  };

  // ---------- Safe storage helpers ----------
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage write failed", e);
      return false;
    }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  // ---------- Date helpers ----------
  function pad2(n) { return String(n).padStart(2, "0"); }
  function toDateStr(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function todayStr() { return toDateStr(new Date()); }
  function parseDateStr(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(dateStr, delta) {
    const d = parseDateStr(dateStr);
    d.setDate(d.getDate() + delta);
    return toDateStr(d);
  }
  function fmtDateLabel(dateStr) {
    const d = parseDateStr(dateStr);
    const isToday = dateStr === todayStr();
    const isYesterday = dateStr === addDays(todayStr(), -1);
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  // ---------- State ----------
  let state = {
    tab: "today",
    currentDate: todayStr(),
    historyRange: 7,
  };

  let profile = lsGet(LS.PROFILE, null);
  let days = lsGet(LS.DAYS, {});
  let myFoods = lsGet(LS.MYFOODS, []);
  let weightLog = lsGet(LS.WEIGHTLOG, []);

  function saveProfile() { lsSet(LS.PROFILE, profile); }
  function saveDays() { lsSet(LS.DAYS, days); }
  function saveMyFoods() { lsSet(LS.MYFOODS, myFoods); }
  function saveWeightLog() { lsSet(LS.WEIGHTLOG, weightLog); }

  function emptyDay() {
    return {
      meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      activities: [],
    };
  }
  function getDay(dateStr) {
    if (!days[dateStr]) days[dateStr] = emptyDay();
    if (!days[dateStr].meals) days[dateStr].meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    if (!days[dateStr].activities) days[dateStr].activities = [];
    return days[dateStr];
  }

  // ---------- Calculations ----------
  function calcBMR(p) {
    const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
    return p.sex === "male" ? base + 5 : base - 161;
  }
  function calcTDEE(p) { return calcBMR(p) * 1.2; }
  function calcDeficitPerDay(p) { return (p.rate * KCAL_PER_KG) / 7; }
  function calcFloorVal(p) {
    const bmr = calcBMR(p);
    const sexFloor = p.sex === "male" ? 1500 : 1200;
    return Math.max(bmr, sexFloor);
  }
  function calcTargetInfo(p) {
    const bmr = calcBMR(p);
    const tdee = calcTDEE(p);
    const deficit = calcDeficitPerDay(p);
    const rawTarget = tdee - deficit;
    const floorVal = calcFloorVal(p);
    const target = Math.max(rawTarget, floorVal);
    const floored = rawTarget < floorVal;
    return { bmr, tdee, deficit, rawTarget, floorVal, target, floored };
  }
  function calcGoalDays(p) {
    const deficit = calcDeficitPerDay(p);
    if (deficit <= 0) return Infinity;
    const kgToLose = p.weight - p.goalWeight;
    if (kgToLose <= 0) return 0;
    return Math.ceil((kgToLose * KCAL_PER_KG) / deficit);
  }
  function calcGoalDateStr(p) {
    const days_ = calcGoalDays(p);
    if (!isFinite(days_)) return null;
    const d = new Date();
    d.setDate(d.getDate() + days_);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  function strideM(p) { return (p.height * 0.415) / 100; }

  function dayConsumed(day) {
    let sum = 0;
    for (const meal of Object.keys(day.meals)) {
      for (const e of day.meals[meal]) sum += e.kcal;
    }
    return sum;
  }
  function dayBurned(day) {
    let sum = 0;
    for (const a of day.activities) sum += a.kcal;
    return sum;
  }

  // ---------- Rendering root ----------
  const viewEl = document.getElementById("view");

  function render() {
    if (!profile) {
      renderOnboarding();
      updateTabbar();
      return;
    }
    if (state.tab === "today") renderToday();
    else if (state.tab === "history") renderHistory();
    else if (state.tab === "profile") renderProfile();
    updateTabbar();
  }

  function updateTabbar() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === state.tab);
    });
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      render();
    });
  });

  // ================= ONBOARDING =================
  function renderOnboarding() {
    const p = {
      sex: "male",
      age: 30,
      height: 170,
      weight: 70,
      goalWeight: 65,
      rate: 0.5,
      meals: { breakfast: "08:00", lunch: "12:30", dinner: "19:30" },
    };
    viewEl.innerHTML = `
      <div class="card">
        <h2>Welcome to FitTrack</h2>
        <p class="hint">Let's set up your profile to calculate your daily calorie target.</p>
      </div>
      <div class="card">
        <div class="profile-field">
          <label>Sex</label>
          <div class="sex-toggle">
            <button type="button" data-sex="male" class="active">Male</button>
            <button type="button" data-sex="female">Female</button>
          </div>
        </div>
        <div class="profile-field">
          <label>Age (years)</label>
          <input type="number" id="ob-age" value="30" min="10" max="100">
        </div>
        <div class="profile-field">
          <label>Height (cm)</label>
          <input type="number" id="ob-height" value="170" min="100" max="250">
        </div>
        <div class="profile-field">
          <label>Current weight (kg)</label>
          <input type="number" id="ob-weight" value="70" min="30" max="300" step="0.1">
        </div>
        <div class="profile-field">
          <label>Goal weight (kg)</label>
          <input type="number" id="ob-goal" value="65" min="30" max="300" step="0.1">
        </div>
        <div class="profile-field">
          <label>Desired weight loss rate</label>
          <div class="rate-options">
            <button type="button" data-rate="0.25">0.25 kg/wk</button>
            <button type="button" data-rate="0.5" class="active">0.5 kg/wk</button>
            <button type="button" data-rate="0.75">0.75 kg/wk</button>
            <button type="button" data-rate="1.0">1.0 kg/wk</button>
          </div>
        </div>
        <div class="profile-field">
          <label>Meal reminder times</label>
          <div class="form-row-inline">
            <div><label>Breakfast</label><input type="time" id="ob-breakfast" value="08:00"></div>
            <div><label>Lunch</label><input type="time" id="ob-lunch" value="12:30"></div>
          </div>
          <div><label>Dinner</label><input type="time" id="ob-dinner" value="19:30"></div>
        </div>
        <div class="disclaimer">
          These figures are estimates only, not medical advice. Consult a doctor before starting any weight-loss plan, especially if you have a health condition. Loss rates above 1 kg/week are not offered here as they are not considered safe for most people.
        </div>
        <button class="primary-btn" id="ob-save">Save & Continue</button>
      </div>
    `;

    let selSex = "male";
    let selRate = 0.5;
    viewEl.querySelectorAll("[data-sex]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selSex = btn.dataset.sex;
        viewEl.querySelectorAll("[data-sex]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    viewEl.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selRate = parseFloat(btn.dataset.rate);
        viewEl.querySelectorAll("[data-rate]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    document.getElementById("ob-save").addEventListener("click", () => {
      const age = parseInt(document.getElementById("ob-age").value, 10) || 30;
      const height = parseFloat(document.getElementById("ob-height").value) || 170;
      const weight = parseFloat(document.getElementById("ob-weight").value) || 70;
      const goalWeight = parseFloat(document.getElementById("ob-goal").value) || 65;
      const breakfast = document.getElementById("ob-breakfast").value || "08:00";
      const lunch = document.getElementById("ob-lunch").value || "12:30";
      const dinner = document.getElementById("ob-dinner").value || "19:30";

      profile = {
        sex: selSex,
        age, height, weight, goalWeight,
        rate: selRate,
        meals: { breakfast, lunch, dinner },
        createdDate: todayStr(),
      };
      saveProfile();
      // seed weight log with starting weight
      weightLog.push({ date: todayStr(), weight });
      saveWeightLog();
      state.tab = "today";
      render();
    });
  }

  // ================= TODAY SCREEN =================
  function renderToday() {
    const day = getDay(state.currentDate);
    const consumed = dayConsumed(day);
    const burned = dayBurned(day);
    const net = consumed - burned;
    const info = calcTargetInfo(profile);
    const target = Math.round(info.target);
    const pct = Math.min(100, Math.round((consumed / target) * 100));
    const isOver = consumed > target;

    const mealLabels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

    let mealsHtml = "";
    for (const mealKey of Object.keys(mealLabels)) {
      const entries = day.meals[mealKey];
      const mealTotal = entries.reduce((s, e) => s + e.kcal, 0);
      mealsHtml += `
        <div class="card meal-section">
          <div class="meal-header">
            <h3>${mealLabels[mealKey]}</h3>
            <span class="meal-total">${Math.round(mealTotal)} kcal</span>
          </div>
          ${entries.length === 0 ? "" : entries.map((e, idx) => `
            <div class="entry-row">
              <div class="entry-main">
                <div class="entry-name">${escapeHtml(e.name)}</div>
                <div class="entry-sub">${escapeHtml(e.serving)}${e.qty !== 1 ? " × " + e.qty : ""}</div>
              </div>
              <div class="entry-kcal">${Math.round(e.kcal)}</div>
              <button class="del-btn" data-meal="${mealKey}" data-idx="${idx}" data-action="del-food">&times;</button>
            </div>
          `).join("")}
          <button class="add-btn" data-meal="${mealKey}" data-action="add-food">+ Add ${mealLabels[mealKey].toLowerCase()}</button>
        </div>
      `;
    }

    const actTotal = burned;
    let actHtml = `
      <div class="card meal-section">
        <div class="meal-header">
          <h3>Activities</h3>
          <span class="meal-total">${Math.round(actTotal)} kcal burned</span>
        </div>
        ${day.activities.length === 0 ? "" : day.activities.map((a, idx) => `
          <div class="entry-row">
            <div class="entry-main">
              <div class="entry-name">${escapeHtml(a.name)}</div>
              <div class="entry-sub">${escapeHtml(a.detail || "")}</div>
            </div>
            <div class="entry-kcal">${Math.round(a.kcal)}</div>
            <button class="del-btn" data-idx="${idx}" data-action="del-activity">&times;</button>
          </div>
        `).join("")}
        <button class="add-btn" data-action="add-activity">+ Add activity</button>
      </div>
    `;

    const activityCard = buildActivityNeededCard(profile, info, consumed, burned);

    viewEl.innerHTML = `
      <div class="date-nav">
        <button id="prevDay">&#8592;</button>
        <div class="date-label">${fmtDateLabel(state.currentDate)}</div>
        <button id="nextDay" ${state.currentDate >= todayStr() ? "disabled" : ""}>&#8594;</button>
      </div>

      <div class="card">
        <h2>Summary</h2>
        <div class="summary-grid">
          <div class="summary-item"><div class="label">Consumed</div><div class="value">${Math.round(consumed)}</div></div>
          <div class="summary-item"><div class="label">Target</div><div class="value">${target}</div></div>
          <div class="summary-item"><div class="label">Exercise burned</div><div class="value">${Math.round(burned)}</div></div>
          <div class="summary-item"><div class="label">Net</div><div class="value">${Math.round(net)}</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar-bg"><div class="progress-bar-fill ${isOver ? "over" : ""}" style="width:${pct}%"></div></div>
          <div class="hint">${pct}% of target${isOver ? " — over target" : ""}</div>
        </div>
      </div>

      ${activityCard}

      <h2 class="section-title">Meals</h2>
      ${mealsHtml}
      ${actHtml}
    `;

    document.getElementById("prevDay").addEventListener("click", () => {
      state.currentDate = addDays(state.currentDate, -1);
      render();
    });
    document.getElementById("nextDay").addEventListener("click", () => {
      if (state.currentDate < todayStr()) {
        state.currentDate = addDays(state.currentDate, 1);
        render();
      }
    });
    viewEl.querySelectorAll('[data-action="add-food"]').forEach((btn) => {
      btn.addEventListener("click", () => openAddFoodSheet(btn.dataset.meal));
    });
    viewEl.querySelectorAll('[data-action="del-food"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const day_ = getDay(state.currentDate);
        day_.meals[btn.dataset.meal].splice(parseInt(btn.dataset.idx, 10), 1);
        saveDays();
        render();
      });
    });
    viewEl.querySelectorAll('[data-action="add-activity"]').forEach((btn) => {
      btn.addEventListener("click", () => openAddActivitySheet());
    });
    viewEl.querySelectorAll('[data-action="del-activity"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const day_ = getDay(state.currentDate);
        day_.activities.splice(parseInt(btn.dataset.idx, 10), 1);
        saveDays();
        render();
      });
    });
  }

  function buildActivityNeededCard(p, info, consumed, burned) {
    // Until the day's intake reaches the target, assume the user will still eat up to it,
    // so a half-logged day doesn't falsely read as "on track".
    const projected = Math.max(consumed, info.target);
    const extraBurn = Math.max(0, projected - info.tdee - burned + info.deficit);
    const hasLogged = consumed > 0 || burned > 0;
    const assumeNote = consumed < info.target
      ? `<p class="hint">Assumes you eat your ${Math.round(info.target)} kcal target today (logged so far: ${Math.round(consumed)}).</p>`
      : "";

    if (!hasLogged) {
      // "plan for the day" version, before food is logged
      const planExtra = Math.max(0, info.floorVal - info.rawTarget);
      if (planExtra <= 1) {
        return `
          <div class="card activity-needed">
            <h2>Plan for today</h2>
            <div class="ontrack-msg">On track — just eat within your ${Math.round(info.target)} kcal target.</div>
          </div>
        `;
      }
      return `
        <div class="card activity-needed">
          <h2>Plan for today</h2>
          <p class="hint">Your calorie floor means part of today's deficit (~${Math.round(planExtra)} kcal) needs to come from activity, even if you eat exactly your target.</p>
          ${renderAltList(planExtra, p)}
        </div>
      `;
    }

    if (extraBurn <= 1) {
      return `
        <div class="card activity-needed">
          <h2>Activity needed today</h2>
          <div class="ontrack-msg">On track — no extra activity needed.</div>
          ${assumeNote}
        </div>
      `;
    }

    return `
      <div class="card activity-needed">
        <h2>Activity needed today</h2>
        <p class="hint">To stay on plan, burn about ${Math.round(extraBurn)} extra kcal. Any one of these alone would do it:</p>
        ${renderAltList(extraBurn, p)}
        ${assumeNote}
      </div>
    `;
  }

  function renderAltList(extraBurn, p) {
    const items = DISTANCE_ACTIVITY_IDS.map((id) => ACTIVITIES.find((a) => a.id === id));
    const rows = items.map((act) => {
      const km = (extraBurn * act.speed) / ((act.met - 1) * p.weight);
      const minutes = (km / act.speed) * 60;
      const showSteps = act.id === "walk" || act.id === "briskwalk";
      let detail = `~${Math.round(minutes)} min`;
      if (showSteps) {
        const steps = Math.round((km * 1000) / strideM(p));
        detail += ` · ~${steps.toLocaleString()} steps`;
      }
      return `
        <div class="alt-item">
          <div>
            <div class="alt-name">${act.name}</div>
            <div class="alt-detail">${detail}</div>
          </div>
          <div class="alt-km">${km.toFixed(1)} km</div>
        </div>
      `;
    }).join("");
    return `<div class="alt-list">${rows}</div>`;
  }

  // ---------- Sheets (bottom modals) ----------
  const sheetRoot = document.getElementById("sheetRoot");
  function openSheet(innerHtml) {
    sheetRoot.innerHTML = `
      <div class="sheet-overlay" id="sheetOverlay">
        <div class="sheet">
          <div class="sheet-handle"></div>
          ${innerHtml}
        </div>
      </div>
    `;
    document.getElementById("sheetOverlay").addEventListener("click", (e) => {
      if (e.target.id === "sheetOverlay") closeSheet();
    });
  }
  function closeSheet() { sheetRoot.innerHTML = ""; }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Add food sheet ----------
  function openAddFoodSheet(mealKey) {
    openSheet(`
      <div class="sheet-title">Add to ${mealKey.charAt(0).toUpperCase() + mealKey.slice(1)}</div>
      <div class="tabs-row">
        <button type="button" id="tab-search" class="active">Search food</button>
        <button type="button" id="tab-custom">Custom</button>
      </div>
      <div id="sheetBody"></div>
    `);

    function showSearch() {
      document.getElementById("tab-search").classList.add("active");
      document.getElementById("tab-custom").classList.remove("active");
      document.getElementById("sheetBody").innerHTML = `
        <input type="search" id="foodSearch" placeholder="Search foods (e.g. roti, ramen, egg)...">
        <div class="food-list" id="foodList"></div>
      `;
      const listEl = document.getElementById("foodList");
      const searchEl = document.getElementById("foodSearch");

      function doSearch(q) {
        const query = q.trim().toLowerCase();
        const mine = myFoods.filter((f) => !query || f.name.toLowerCase().includes(query));
        const built = BUILTIN_FOODS.filter((f) => !query || f.name.toLowerCase().includes(query));
        const combined = [...mine.map((f) => ({ ...f, mine: true })), ...built];
        const limited = combined.slice(0, 60);
        listEl.innerHTML = limited.length ? limited.map((f) => `
          <div class="food-item">
            <div>
              <div class="fname">${escapeHtml(f.name)}${f.mine ? " ★" : ""}</div>
              <div class="fserv">${escapeHtml(f.serving)} <span class="fkcal">${f.kcal} kcal</span></div>
            </div>
            <button class="pick-btn" data-id="${f.id}" data-mine="${f.mine ? "1" : "0"}">Add</button>
          </div>
        `).join("") : `<div class="empty-state">No foods found</div>`;

        listEl.querySelectorAll(".pick-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const source = btn.dataset.mine === "1" ? myFoods : BUILTIN_FOODS;
            const food = source.find((f) => f.id === btn.dataset.id);
            openQtySheet(mealKey, food);
          });
        });
      }
      doSearch("");
      searchEl.addEventListener("input", () => doSearch(searchEl.value));
    }

    function showCustom() {
      document.getElementById("tab-search").classList.remove("active");
      document.getElementById("tab-custom").classList.add("active");
      document.getElementById("sheetBody").innerHTML = `
        <div class="form-row">
          <label>Food name</label>
          <input type="text" id="custName" placeholder="e.g. Homemade sandwich">
        </div>
        <div class="form-row">
          <label>Calories (kcal)</label>
          <input type="number" id="custKcal" min="0" step="1" placeholder="e.g. 350">
        </div>
        <div class="form-row">
          <label><input type="checkbox" id="custSave" style="width:auto;margin-right:6px;"> Save to My foods</label>
        </div>
        <button class="primary-btn" id="custAdd">Add</button>
      `;
      document.getElementById("custAdd").addEventListener("click", () => {
        const name = document.getElementById("custName").value.trim() || "Custom food";
        const kcal = parseFloat(document.getElementById("custKcal").value) || 0;
        const save = document.getElementById("custSave").checked;
        const entry = { name, serving: "custom entry", kcal, qty: 1 };
        const day = getDay(state.currentDate);
        day.meals[mealKey].push(entry);
        saveDays();
        if (save) {
          myFoods.unshift({ id: "my_" + Date.now(), name, serving: "custom", kcal });
          saveMyFoods();
        }
        closeSheet();
        render();
      });
    }

    document.getElementById("tab-search").addEventListener("click", showSearch);
    document.getElementById("tab-custom").addEventListener("click", showCustom);
    showSearch();
  }

  function openQtySheet(mealKey, food) {
    let qty = 1;
    openSheet(`
      <div class="sheet-title">${escapeHtml(food.name)}</div>
      <div class="hint">${escapeHtml(food.serving)} · ${food.kcal} kcal per serving</div>
      <div class="qty-row">
        <button id="qtyMinus">-</button>
        <div id="qtyVal" style="font-size:1.2rem;font-weight:700;min-width:50px;text-align:center;">1</div>
        <button id="qtyPlus">+</button>
        <div class="hint" style="margin-left:auto;">= <span id="qtyKcal">${food.kcal}</span> kcal</div>
      </div>
      <button class="primary-btn" id="qtyAdd">Add</button>
    `);
    function updateQty() {
      document.getElementById("qtyVal").textContent = qty;
      document.getElementById("qtyKcal").textContent = Math.round(food.kcal * qty);
    }
    document.getElementById("qtyMinus").addEventListener("click", () => {
      qty = Math.max(0.5, qty - 0.5);
      updateQty();
    });
    document.getElementById("qtyPlus").addEventListener("click", () => {
      qty = qty + 0.5;
      updateQty();
    });
    document.getElementById("qtyAdd").addEventListener("click", () => {
      const day = getDay(state.currentDate);
      day.meals[mealKey].push({ name: food.name, serving: food.serving, kcal: food.kcal * qty, qty });
      saveDays();
      closeSheet();
      render();
    });
  }

  // ---------- Add activity sheet ----------
  function openAddActivitySheet() {
    openSheet(`
      <div class="sheet-title">Add activity</div>
      <div class="form-row">
        <label>Activity type</label>
        <select id="actType">
          ${ACTIVITIES.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}
          <option value="custom">Custom (enter kcal directly)</option>
        </select>
      </div>
      <div id="actBody"></div>
    `);

    function renderActBody() {
      const val = document.getElementById("actType").value;
      const body = document.getElementById("actBody");
      if (val === "custom") {
        body.innerHTML = `
          <div class="form-row">
            <label>Description</label>
            <input type="text" id="custActName" placeholder="e.g. Football match">
          </div>
          <div class="form-row">
            <label>Calories burned (kcal)</label>
            <input type="number" id="custActKcal" min="0" step="1">
          </div>
          <button class="primary-btn" id="custActAdd">Add</button>
        `;
        document.getElementById("custActAdd").addEventListener("click", () => {
          const name = document.getElementById("custActName").value.trim() || "Custom activity";
          const kcal = parseFloat(document.getElementById("custActKcal").value) || 0;
          addActivityEntry({ name, kcal, detail: "custom" });
        });
        return;
      }

      const act = ACTIVITIES.find((a) => a.id === val);
      if (act.kind === "distance") {
        body.innerHTML = `
          <div class="tabs-row">
            <button type="button" data-mode="minutes" class="active">Minutes</button>
            <button type="button" data-mode="km">Distance (km)</button>
            <button type="button" data-mode="steps">Steps</button>
          </div>
          <div class="form-row">
            <input type="number" id="actInput" min="0" step="0.1" placeholder="Enter value">
          </div>
          <div class="hint" id="actPreview"></div>
          <button class="primary-btn" id="distActAdd">Add</button>
        `;
        let mode = "minutes";
        body.querySelectorAll("[data-mode]").forEach((btn) => {
          btn.addEventListener("click", () => {
            mode = btn.dataset.mode;
            body.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
            document.getElementById("actInput").value = "";
            updatePreview();
          });
        });
        function computeFromInput() {
          const raw = parseFloat(document.getElementById("actInput").value) || 0;
          let km;
          if (mode === "minutes") km = (raw / 60) * act.speed;
          else if (mode === "km") km = raw;
          else km = (raw * strideM(profile)) / 1000;
          const hours = km / act.speed;
          const kcal = (act.met - 1) * profile.weight * hours;
          const minutes = hours * 60;
          const steps = Math.round((km * 1000) / strideM(profile));
          return { km, minutes, kcal, steps };
        }
        function updatePreview() {
          const r = computeFromInput();
          document.getElementById("actPreview").textContent =
            `${r.km.toFixed(2)} km · ~${Math.round(r.minutes)} min · ~${r.steps.toLocaleString()} steps · ${Math.round(r.kcal)} kcal burned`;
        }
        document.getElementById("actInput").addEventListener("input", updatePreview);
        updatePreview();
        document.getElementById("distActAdd").addEventListener("click", () => {
          const r = computeFromInput();
          if (r.km <= 0) return;
          addActivityEntry({
            name: act.name,
            kcal: r.kcal,
            detail: `${r.km.toFixed(2)} km · ~${Math.round(r.minutes)} min`,
          });
        });
      } else {
        body.innerHTML = `
          <div class="form-row">
            <label>Minutes</label>
            <input type="number" id="genMinutes" min="0" step="1" placeholder="e.g. 30">
          </div>
          <div class="hint" id="genPreview"></div>
          <button class="primary-btn" id="genActAdd">Add</button>
        `;
        function updatePreview() {
          const minutes = parseFloat(document.getElementById("genMinutes").value) || 0;
          const hours = minutes / 60;
          const kcal = (act.met - 1) * profile.weight * hours;
          document.getElementById("genPreview").textContent = `${Math.round(kcal)} kcal burned`;
        }
        document.getElementById("genMinutes").addEventListener("input", updatePreview);
        updatePreview();
        document.getElementById("genActAdd").addEventListener("click", () => {
          const minutes = parseFloat(document.getElementById("genMinutes").value) || 0;
          if (minutes <= 0) return;
          const hours = minutes / 60;
          const kcal = (act.met - 1) * profile.weight * hours;
          addActivityEntry({ name: act.name, kcal, detail: `${Math.round(minutes)} min` });
        });
      }
    }

    function addActivityEntry(entry) {
      const day = getDay(state.currentDate);
      day.activities.push(entry);
      saveDays();
      closeSheet();
      render();
    }

    document.getElementById("actType").addEventListener("change", renderActBody);
    renderActBody();
  }

  // ================= HISTORY SCREEN =================
  function renderHistory() {
    const range = state.historyRange;
    const dateList = [];
    for (let i = range - 1; i >= 0; i--) dateList.push(addDays(todayStr(), -i));
    const info = calcTargetInfo(profile);
    const target = info.target;

    const consumedArr = dateList.map((d) => dayConsumed(getDay(d)));
    const burnedArr = dateList.map((d) => dayBurned(getDay(d)));

    const chartSvg = buildBarChart(dateList, consumedArr, burnedArr, target);

    const weightChart = buildWeightChart();

    viewEl.innerHTML = `
      <div class="card">
        <h2>Calories: last ${range} days</h2>
        <div class="range-toggle">
          <button data-range="7" class="${range === 7 ? "active" : ""}">7 days</button>
          <button data-range="30" class="${range === 30 ? "active" : ""}">30 days</button>
        </div>
        <div class="chart-wrap">${chartSvg}</div>
        <div class="legend">
          <span><span class="dot" style="background:#16a34a"></span>Consumed</span>
          <span><span class="dot" style="background:#f97316"></span>Burned</span>
          <span><span class="dot" style="background:#64748b"></span>Target line</span>
        </div>
      </div>

      <div class="card">
        <h2>Weight log</h2>
        <div class="form-row-inline">
          <div>
            <label>Today's weight (kg)</label>
            <input type="number" id="weightInput" step="0.1" value="${profile.weight}">
          </div>
        </div>
        <button class="primary-btn" id="logWeightBtn">Log weight</button>
        <div class="chart-wrap" style="margin-top:14px;">${weightChart}</div>
        <div class="legend">
          <span><span class="dot" style="background:#16a34a"></span>Weight</span>
          <span><span class="dot" style="background:#64748b"></span>7-day avg</span>
        </div>
      </div>
    `;

    viewEl.querySelectorAll("[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.historyRange = parseInt(btn.dataset.range, 10);
        render();
      });
    });

    document.getElementById("logWeightBtn").addEventListener("click", () => {
      const w = parseFloat(document.getElementById("weightInput").value);
      if (!w || w <= 0) return;
      const today = todayStr();
      const existingIdx = weightLog.findIndex((e) => e.date === today);
      if (existingIdx >= 0) weightLog[existingIdx].weight = w;
      else weightLog.push({ date: today, weight: w });
      weightLog.sort((a, b) => (a.date < b.date ? -1 : 1));
      saveWeightLog();
      profile.weight = w;
      saveProfile();
      render();
    });
  }

  function buildBarChart(dateList, consumedArr, burnedArr, target) {
    const w = 320, h = 160, padL = 28, padB = 22, padT = 8, padR = 8;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const maxVal = Math.max(target * 1.15, ...consumedArr, ...burnedArr, 1);
    const n = dateList.length;
    const groupW = plotW / n;
    const barW = Math.max(2, groupW * 0.32);

    function yFor(v) { return padT + plotH - (v / maxVal) * plotH; }

    let bars = "";
    dateList.forEach((d, i) => {
      const gx = padL + i * groupW;
      const cH = (consumedArr[i] / maxVal) * plotH;
      const bH = (burnedArr[i] / maxVal) * plotH;
      bars += `<rect x="${gx + groupW * 0.15}" y="${padT + plotH - cH}" width="${barW}" height="${cH}" fill="#16a34a" rx="1.5"></rect>`;
      bars += `<rect x="${gx + groupW * 0.53}" y="${padT + plotH - bH}" width="${barW}" height="${bH}" fill="#f97316" rx="1.5"></rect>`;
    });

    // x labels: show every label if <=7, else every 5th
    let labels = "";
    const step = n <= 7 ? 1 : 5;
    dateList.forEach((d, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      const gx = padL + i * groupW + groupW / 2;
      const lbl = parseDateStr(d).getDate();
      labels += `<text x="${gx}" y="${h - 4}" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">${lbl}</text>`;
    });

    const targetY = yFor(target);
    const targetLine = `<line x1="${padL}" y1="${targetY}" x2="${w - padR}" y2="${targetY}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,3"></line>`;

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Calorie chart">
      ${bars}
      ${targetLine}
      ${labels}
    </svg>`;
  }

  function buildWeightChart() {
    if (weightLog.length === 0) {
      return `<div class="empty-state">No weight entries yet</div>`;
    }
    const sorted = [...weightLog].sort((a, b) => (a.date < b.date ? -1 : 1));
    const recent = sorted.slice(-30);
    const w = 320, h = 140, padL = 28, padB = 18, padT = 10, padR = 8;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const weights = recent.map((e) => e.weight);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;
    const n = recent.length;

    function xFor(i) { return n <= 1 ? padL : padL + (i / (n - 1)) * plotW; }
    function yFor(v) { return padT + plotH - ((v - minW) / (maxW - minW || 1)) * plotH; }

    const linePts = recent.map((e, i) => `${xFor(i)},${yFor(e.weight)}`).join(" ");

    // 7-day moving average
    const avgPts = recent.map((e, i) => {
      const windowStart = Math.max(0, i - 6);
      const windowArr = recent.slice(windowStart, i + 1);
      const avg = windowArr.reduce((s, x) => s + x.weight, 0) / windowArr.length;
      return `${xFor(i)},${yFor(avg)}`;
    }).join(" ");

    const dots = recent.map((e, i) => `<circle cx="${xFor(i)}" cy="${yFor(e.weight)}" r="2.2" fill="#16a34a"></circle>`).join("");

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Weight chart">
      <polyline points="${avgPts}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,3"></polyline>
      <polyline points="${linePts}" fill="none" stroke="#16a34a" stroke-width="2"></polyline>
      ${dots}
    </svg>`;
  }

  // ================= PROFILE SCREEN =================
  function renderProfile() {
    const info = calcTargetInfo(profile);
    const goalDate = calcGoalDateStr(profile);

    viewEl.innerHTML = `
      <div class="card">
        <h2>Your numbers</h2>
        <div class="stat-line"><span class="k">BMR</span><span class="v">${Math.round(info.bmr)} kcal</span></div>
        <div class="stat-line"><span class="k">TDEE (sedentary baseline)</span><span class="v">${Math.round(info.tdee)} kcal</span></div>
        <div class="stat-line"><span class="k">Planned deficit</span><span class="v">${Math.round(info.deficit)} kcal/day</span></div>
        <div class="stat-line"><span class="k">Daily intake target</span><span class="v">${Math.round(info.target)} kcal</span></div>
        <div class="stat-line"><span class="k">Projected goal date</span><span class="v">${goalDate || "—"}</span></div>
        ${info.floored ? `<div class="warn-box">Your calorie floor (${Math.round(info.floorVal)} kcal) is higher than the diet-only target. Part of your planned deficit needs to come from activity — see the Today screen.</div>` : ""}
        <div class="disclaimer">Estimates only, not medical advice. Consult a doctor before starting a weight-loss plan.</div>
      </div>

      <div class="card">
        <h2>Edit profile</h2>
        <div class="profile-field">
          <label>Sex</label>
          <div class="sex-toggle">
            <button type="button" data-sex="male" class="${profile.sex === "male" ? "active" : ""}">Male</button>
            <button type="button" data-sex="female" class="${profile.sex === "female" ? "active" : ""}">Female</button>
          </div>
        </div>
        <div class="profile-field"><label>Age (years)</label><input type="number" id="p-age" value="${profile.age}"></div>
        <div class="profile-field"><label>Height (cm)</label><input type="number" id="p-height" value="${profile.height}"></div>
        <div class="profile-field"><label>Current weight (kg)</label><input type="number" id="p-weight" step="0.1" value="${profile.weight}"></div>
        <div class="profile-field"><label>Goal weight (kg)</label><input type="number" id="p-goal" step="0.1" value="${profile.goalWeight}"></div>
        <div class="profile-field">
          <label>Desired weight loss rate</label>
          <div class="rate-options">
            <button type="button" data-rate="0.25" class="${profile.rate === 0.25 ? "active" : ""}">0.25 kg/wk</button>
            <button type="button" data-rate="0.5" class="${profile.rate === 0.5 ? "active" : ""}">0.5 kg/wk</button>
            <button type="button" data-rate="0.75" class="${profile.rate === 0.75 ? "active" : ""}">0.75 kg/wk</button>
            <button type="button" data-rate="1.0" class="${profile.rate === 1.0 ? "active" : ""}">1.0 kg/wk</button>
          </div>
        </div>
        <div class="profile-field">
          <label>Meal reminders</label>
          <div class="form-row-inline">
            <div><label>Breakfast</label><input type="time" id="p-breakfast" value="${profile.meals.breakfast}"></div>
            <div><label>Lunch</label><input type="time" id="p-lunch" value="${profile.meals.lunch}"></div>
          </div>
          <div><label>Dinner</label><input type="time" id="p-dinner" value="${profile.meals.dinner}"></div>
        </div>
        <button class="primary-btn" id="p-save">Save changes</button>
      </div>

      <div class="card">
        <h2>Reminders</h2>
        <p class="hint">Get an in-app banner when it's time to log a meal. You can also enable device notifications (only work while the app/browser is open or recently backgrounded).</p>
        <button class="secondary-btn" id="enableNotifBtn">${Notification && Notification.permission === "granted" ? "Notifications enabled" : "Enable notifications"}</button>
      </div>

      <div class="card">
        <h2>Data</h2>
        <div class="settings-btn-row">
          <button class="secondary-btn" id="exportBtn">Export data (JSON)</button>
          <button class="secondary-btn" id="importBtn">Import data</button>
          <input type="file" id="importFile" accept="application/json">
          <button class="secondary-btn" id="resetBtn" style="color:var(--danger);">Reset all data</button>
        </div>
      </div>
    `;

    let selSex = profile.sex;
    let selRate = profile.rate;
    viewEl.querySelectorAll("[data-sex]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selSex = btn.dataset.sex;
        viewEl.querySelectorAll("[data-sex]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    viewEl.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selRate = parseFloat(btn.dataset.rate);
        viewEl.querySelectorAll("[data-rate]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    document.getElementById("p-save").addEventListener("click", () => {
      profile.sex = selSex;
      profile.age = parseInt(document.getElementById("p-age").value, 10) || profile.age;
      profile.height = parseFloat(document.getElementById("p-height").value) || profile.height;
      profile.weight = parseFloat(document.getElementById("p-weight").value) || profile.weight;
      profile.goalWeight = parseFloat(document.getElementById("p-goal").value) || profile.goalWeight;
      profile.rate = selRate;
      profile.meals.breakfast = document.getElementById("p-breakfast").value || profile.meals.breakfast;
      profile.meals.lunch = document.getElementById("p-lunch").value || profile.meals.lunch;
      profile.meals.dinner = document.getElementById("p-dinner").value || profile.meals.dinner;
      saveProfile();
      render();
    });

    document.getElementById("enableNotifBtn").addEventListener("click", enableNotifications);

    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
    document.getElementById("importFile").addEventListener("change", importDataFile);
    document.getElementById("resetBtn").addEventListener("click", resetAllData);
  }

  function exportData() {
    const payload = {
      profile,
      days,
      myFoods,
      weightLog,
      exportedAt: new Date().toISOString(),
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fittrack-export-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  }

  function importDataFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.profile) { profile = parsed.profile; saveProfile(); }
        if (parsed.days) { days = parsed.days; saveDays(); }
        if (parsed.myFoods) { myFoods = parsed.myFoods; saveMyFoods(); }
        if (parsed.weightLog) { weightLog = parsed.weightLog; saveWeightLog(); }
        alert("Import successful");
        render();
      } catch (err) {
        alert("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
  }

  function resetAllData() {
    if (!confirm("This will permanently delete all your FitTrack data on this device. Continue?")) return;
    lsRemove(LS.PROFILE);
    lsRemove(LS.DAYS);
    lsRemove(LS.MYFOODS);
    lsRemove(LS.WEIGHTLOG);
    lsRemove(LS.NOTIF);
    lsRemove(LS.DISMISSED);
    profile = null;
    days = {};
    myFoods = [];
    weightLog = [];
    state.tab = "today";
    state.currentDate = todayStr();
    render();
  }

  // ================= REMINDERS =================
  function timeNowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function parseTimeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }
  function getDismissed(dateStr) {
    const all = lsGet(LS.DISMISSED, {});
    return all[dateStr] || [];
  }
  function setDismissed(dateStr, mealKey) {
    const all = lsGet(LS.DISMISSED, {});
    all[dateStr] = all[dateStr] || [];
    if (!all[dateStr].includes(mealKey)) all[dateStr].push(mealKey);
    lsSet(LS.DISMISSED, all);
  }

  function checkReminders() {
    if (!profile) return;
    const today = todayStr();
    const day = getDay(today);
    const nowMin = timeNowMinutes();
    const dismissed = getDismissed(today);
    const mealsToCheck = [
      { key: "breakfast", label: "breakfast", time: profile.meals.breakfast },
      { key: "lunch", label: "lunch", time: profile.meals.lunch },
      { key: "dinner", label: "dinner", time: profile.meals.dinner },
    ];
    for (const m of mealsToCheck) {
      const reminderMin = parseTimeToMinutes(m.time);
      const empty = day.meals[m.key].length === 0;
      if (empty && nowMin >= reminderMin && !dismissed.includes(m.key)) {
        showReminderBanner(m.key, m.label);
        return;
      }
    }
    hideReminderBanner();
  }

  const bannerEl = document.getElementById("reminderBanner");
  const bannerTextEl = document.getElementById("reminderText");
  const bannerActionBtn = document.getElementById("reminderActionBtn");
  const bannerDismissBtn = document.getElementById("reminderDismissBtn");

  function showReminderBanner(mealKey, mealLabel) {
    bannerTextEl.textContent = `Time to log ${mealLabel} — what did you eat?`;
    bannerEl.classList.add("show");
    bannerActionBtn.onclick = () => {
      hideReminderBanner();
      state.tab = "today";
      state.currentDate = todayStr();
      render();
      openAddFoodSheet(mealKey);
    };
    bannerDismissBtn.onclick = () => {
      setDismissed(todayStr(), mealKey);
      hideReminderBanner();
    };
  }
  function hideReminderBanner() {
    bannerEl.classList.remove("show");
  }

  // Notifications via service worker (only reliable while app/browser is open or recently backgrounded)
  function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Notifications are not supported in this browser.");
      return;
    }
    Notification.requestPermission().then((perm) => {
      lsSet(LS.NOTIF, perm === "granted");
      render();
    });
  }

  function checkNotificationSchedule() {
    if (!profile) return;
    if (!lsGet(LS.NOTIF, false)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = todayStr();
    const day = getDay(today);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const mealsToCheck = [
      { key: "breakfast", label: "Breakfast", time: profile.meals.breakfast },
      { key: "lunch", label: "Lunch", time: profile.meals.lunch },
      { key: "dinner", label: "Dinner", time: profile.meals.dinner },
    ];
    for (const m of mealsToCheck) {
      const reminderMin = parseTimeToMinutes(m.time);
      const empty = day.meals[m.key].length === 0;
      if (empty && nowMin === reminderMin) {
        fireNotification(`${m.label} reminder`, `Time to log ${m.label.toLowerCase()} — what did you eat?`);
      }
    }
  }
  function fireNotification(title, body) {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png" });
      }).catch(() => {
        try { new Notification(title, { body }); } catch (e) { /* ignore */ }
      });
    } else {
      try { new Notification(title, { body }); } catch (e) { /* ignore */ }
    }
  }

  // ================= INSTALL PROMPT =================
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById("installBtn").style.display = "inline-block";
  });
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById("installBtn").style.display = "none";
  });
  window.addEventListener("appinstalled", () => {
    document.getElementById("installBtn").style.display = "none";
  });

  // ================= SERVICE WORKER =================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration failed", err);
      });
    });
  }

  // ================= INIT =================
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkReminders();
  });
  window.addEventListener("focus", checkReminders);
  setInterval(() => {
    checkReminders();
    checkNotificationSchedule();
  }, 60 * 1000);

  render();
  checkReminders();
})();
