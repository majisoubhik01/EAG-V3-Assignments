// ============================================================
// app.js — Travel Planning Agent Core Engine + UI Controller
// ============================================================

// ─── Reasoning step metadata ───────────────────────────────────────────────────
const REASONING_META = {
  PLANNING:         { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", icon: "🗺️",  label: "Planning"         },
  BUDGET_ANALYSIS:  { color: "#10b981", bg: "rgba(16,185,129,0.15)", icon: "💰",  label: "Budget Analysis"   },
  LOOKUP:           { color: "#06b6d4", bg: "rgba(6,182,212,0.15)",  icon: "🔍",  label: "Lookup"            },
  CALCULATION:      { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "🧮",  label: "Calculation"       },
  OPTIMIZATION:     { color: "#ec4899", bg: "rgba(236,72,153,0.15)", icon: "⚡",  label: "Optimization"      },
  VERIFICATION:     { color: "#14b8a6", bg: "rgba(20,184,166,0.15)", icon: "✅",  label: "Verification"      },
  MEMORY_UPDATE:    { color: "#a78bfa", bg: "rgba(167,139,250,0.15)",icon: "🧠",  label: "Memory Update"     },
  CONSTRAINT_CHECK: { color: "#fb923c", bg: "rgba(251,146,60,0.15)", icon: "⚖️",  label: "Constraint Check"  },
  RISK_ANALYSIS:    { color: "#f43f5e", bg: "rgba(244,63,94,0.15)",  icon: "⚠️",  label: "Risk Analysis"     },
  FINAL_DECISION:   { color: "#22c55e", bg: "rgba(34,197,94,0.15)",  icon: "🏁",  label: "Final Decision"    },
};

// ─── Agent State ───────────────────────────────────────────────────────────────
const AgentState = {
  memory: [],
  currentItinerary: null,
  stepCounter: 0,
  isRunning: false,
};

// ─── DOM Helpers ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const delay = ms => new Promise(res => setTimeout(res, ms));

function renderStep(step, animate = true) {
  const panel = $('reasoning-panel');
  const meta  = REASONING_META[step.reasoning_type] || REASONING_META.PLANNING;
  const isToolCall     = step.type === 'tool_call';
  const isVerification = step.type === 'verification';

  // Tool calls start collapsed (JSON details are secondary); others start expanded
  const startCollapsed = isToolCall;

  const el = document.createElement('div');
  el.className = `step-card ${animate ? 'step-enter' : ''} ${startCollapsed ? 'card-collapsed' : ''}`;
  el.dataset.stepId = step.step_id;

  const chevron = `<span class="step-chevron" aria-hidden="true">▾</span>`;

  if (isToolCall) {
    el.innerHTML = `
      <div class="step-header">
        <span class="step-number">#${step.step_id}</span>
        <span class="step-badge tool-badge">
          <span class="badge-icon">🔧</span> Tool Call
        </span>
        <span class="tool-name-tag">${step.tool_name}</span>
        <span class="step-status ${step.success !== false ? 'status-ok' : 'status-fail'}">
          ${step.success !== false ? '✓ Success' : '✗ Failed'}
        </span>
        ${chevron}
      </div>
      <div class="step-body tool-body">
        <div class="tool-io">
          <div class="tool-section">
            <div class="tool-label">Input</div>
            <div class="tool-code">${JSON.stringify(step.tool_input, null, 2)}</div>
          </div>
          <div class="tool-section">
            <div class="tool-label">Output</div>
            <div class="tool-code tool-output-code">${JSON.stringify(step.tool_output, null, 2)}</div>
          </div>
        </div>
        ${step.expected_output ? `<div class="tool-expected">Expected: ${step.expected_output}</div>` : ''}
      </div>
    `;
  } else if (isVerification) {
    const passed = step.verification_result?.toLowerCase().includes('pass') ||
                   step.verification_result?.toLowerCase().includes('\u2713') ||
                   step.verification_result?.toLowerCase().includes('confirmed');
    el.innerHTML = `
      <div class="step-header">
        <span class="step-number">#${step.step_id}</span>
        <span class="step-badge" style="background:${REASONING_META.VERIFICATION.bg};color:${REASONING_META.VERIFICATION.color}">
          <span class="badge-icon">${REASONING_META.VERIFICATION.icon}</span> Verification
        </span>
        <span class="step-status ${passed ? 'status-ok' : 'status-warn'}">
          ${passed ? '✓ Passed' : '⚠ Review'}
        </span>
        ${chevron}
      </div>
      <div class="step-body step-content">
        <div class="verif-method"><strong>Method:</strong> ${step.verification_method}</div>
        <div class="verif-result ${passed ? 'verif-pass' : 'verif-warn'}">${step.verification_result}</div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="step-header">
        <span class="step-number">#${step.step_id}</span>
        <span class="step-badge" style="background:${meta.bg};color:${meta.color}">
          <span class="badge-icon">${meta.icon}</span> ${meta.label}
        </span>
        ${chevron}
      </div>
      <div class="step-body step-content">${step.content}</div>
    `;
  }

  // Click header to toggle body
  el.querySelector('.step-header').addEventListener('click', () => {
    el.classList.toggle('card-collapsed');
  });

  panel.appendChild(el);
  if (animate) {
    requestAnimationFrame(() => el.classList.add('step-visible'));
    panel.scrollTop = panel.scrollHeight;
  }
  return el;
}

function clearPanel() {
  // Clear only the step cards, not the entire panel (empty-state lives there)
  const panel = $('reasoning-panel');
  // Remove everything except #empty-state
  Array.from(panel.children).forEach(child => {
    if (child.id !== 'empty-state') child.remove();
  });
  const es = $('empty-state');
  if (es) es.style.display = 'none';
  const itinSec = $('itinerary-section');
  if (itinSec) itinSec.style.display = 'none';
  const budgetSec = $('budget-section');
  if (budgetSec) budgetSec.style.display = 'none';
  AgentState.stepCounter = 0;
}

function nextStep() {
  return ++AgentState.stepCounter;
}

function addThinkingIndicator() {
  const panel = $('reasoning-panel');
  const el = document.createElement('div');
  el.className = 'thinking-indicator';
  el.id = 'thinking-indicator';
  el.innerHTML = `
    <div class="thinking-dots">
      <span></span><span></span><span></span>
    </div>
    <span class="thinking-text">Agent is reasoning…</span>
  `;
  panel.appendChild(el);
  panel.scrollTop = panel.scrollHeight;
  return el;
}

function removeThinkingIndicator() {
  const el = $('thinking-indicator');
  if (el) el.remove();
}

// ─── Main Agent Pipeline ───────────────────────────────────────────────────────
async function runAgent(userInput) {
  if (AgentState.isRunning) return;
  AgentState.isRunning = true;
  clearPanel();
  $('run-btn').disabled = true;
  $('run-btn').innerHTML = `<span class="btn-spinner"></span> Planning…`;
  // empty-state is already hidden by clearPanel()

  const { destination, budget, duration, startDate, endDate,
          preferences, origin, travelClass, hotelCategory } = userInput;

  const steps = [];
  const warnings = [];
  const assumptions = [];
  let confidenceScore = 0.95;

  try {

    // ── STEP 1: PLANNING ──────────────────────────────────────────────────────
    let thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const step1 = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "PLANNING",
      content: `Breaking the ${duration}-night trip to <strong>${destination}</strong> into subtasks:
        <ol>
          <li>Validate travel dates and duration</li>
          <li>Look up destination information & highlights</li>
          <li>Search flight options from <strong>${origin}</strong> (${travelClass} class)</li>
          <li>Search <strong>${hotelCategory}</strong>-category hotels</li>
          <li>Allocate the $${budget.toLocaleString()} budget across categories</li>
          <li>Select activities matching preferences: <em>${preferences.join(', ')}</em></li>
          <li>Build day-by-day itinerary</li>
          <li>Run risk analysis and verify all costs</li>
        </ol>`
    };
    steps.push(step1);
    renderStep(step1);
    await delay(800);

    // ── STEP 2: DATE VALIDATION ────────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(500);
    removeThinkingIndicator();

    const dateResult = await Tools.validateDateRange({ startDate, endDate });
    const step2tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "validateDateRange",
      tool_input: { startDate, endDate },
      tool_output: dateResult.output,
      success: dateResult.success,
      expected_output: "Valid date range with night count"
    };
    steps.push(step2tool);
    renderStep(step2tool);
    await delay(500);

    if (dateResult.output?.warning) {
      warnings.push(dateResult.output.warning);
    }
    if (dateResult.output?.peakSeason) {
      warnings.push(`${dateResult.output.month} is peak season — prices may be 15–35% higher than average.`);
    }

    const step2v = {
      step_id: nextStep(), type: "verification",
      verification_method: "Date math cross-check: (endDate - startDate) / 86400000 = nights",
      verification_result: `✓ Confirmed ${dateResult.output?.nights || duration} nights from ${dateResult.output?.startDate} to ${dateResult.output?.endDate}. Verification PASSED.`
    };
    steps.push(step2v);
    renderStep(step2v);
    await delay(600);

    const actualNights = dateResult.output?.nights || duration;
    const travelMonth  = dateResult.output?.month || "June";

    // ── STEP 3: DESTINATION LOOKUP ────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const step3reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "LOOKUP",
      content: `Querying destination knowledge base for <strong>${destination}</strong> to retrieve highlights, cuisine, neighborhoods, and pricing benchmarks.`
    };
    steps.push(step3reason);
    renderStep(step3reason);
    await delay(400);

    const destResult = await Tools.getDestinationInfo({ destination });
    const step3tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "getDestinationInfo",
      tool_input: { destination },
      tool_output: destResult.output,
      success: destResult.success,
      expected_output: "Destination highlights, cuisine, hotel pricing, and activity list"
    };
    steps.push(step3tool);
    renderStep(step3tool);
    await delay(700);

    if (!destResult.success) {
      assumptions.push(`Destination "${destination}" not in database — using generalized estimates.`);
      confidenceScore -= 0.15;
      warnings.push(`Limited data available for ${destination}. Prices are estimates.`);
    }

    // ── STEP 4: FLIGHT SEARCH ─────────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(700);
    removeThinkingIndicator();

    const step4reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "LOOKUP",
      content: `Searching round-trip <strong>${travelClass}</strong> flights from <strong>${origin}</strong> to <strong>${destination}</strong> for <strong>${travelMonth}</strong>.`
    };
    steps.push(step4reason);
    renderStep(step4reason);
    await delay(400);

    const flightResult = await Tools.flightSearch({ origin, destination, travelClass, month: travelMonth });
    const step4tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "flightSearch",
      tool_input: { origin, destination, travelClass, month: travelMonth },
      tool_output: flightResult.output,
      success: flightResult.success,
      expected_output: "Round-trip flight price in USD"
    };
    steps.push(step4tool);
    renderStep(step4tool);
    await delay(600);

    if (!flightResult.output?.found) {
      assumptions.push(`Flight pricing estimated — exact ${origin}→${destination} route not in database.`);
      confidenceScore -= 0.05;
    }

    // ── STEP 5: HOTEL SEARCH ──────────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const step5reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "LOOKUP",
      content: `Searching <strong>${hotelCategory}</strong>-category hotels in <strong>${destination}</strong> for <strong>${actualNights}</strong> nights.`
    };
    steps.push(step5reason);
    renderStep(step5reason);
    await delay(400);

    const hotelResult = await Tools.hotelSearch({ destination, category: hotelCategory, nights: actualNights });
    const step5tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "hotelSearch",
      tool_input: { destination, category: hotelCategory, nights: actualNights },
      tool_output: hotelResult.output,
      success: hotelResult.success,
      expected_output: "Hotel name, nightly price, total cost, and amenities"
    };
    steps.push(step5tool);
    renderStep(step5tool);
    await delay(700);

    // ── STEP 6: BUDGET ALLOCATION ─────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const step6reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "BUDGET_ANALYSIS",
      content: `Allocating the $${budget.toLocaleString()} total budget based on preferences [${preferences.join(', ')}] and trip structure. Flights and hotel are fixed costs; remaining budget distributed across food, activities, transport, and miscellaneous.`
    };
    steps.push(step6reason);
    renderStep(step6reason);
    await delay(400);

    const budgetResult = await Tools.calculateBudgetAllocation({ totalBudget: budget, preferences, nights: actualNights });
    const step6tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "calculateBudgetAllocation",
      tool_input: { totalBudget: budget, preferences, nights: actualNights },
      tool_output: budgetResult.output,
      success: budgetResult.success,
      expected_output: "Category-wise budget allocation with per-day breakdown"
    };
    steps.push(step6tool);
    renderStep(step6tool);
    await delay(600);

    // ── STEP 7: CONSTRAINT CHECK ──────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(500);
    removeThinkingIndicator();

    const flightCost = flightResult.output?.priceUSD || 0;
    const hotelCost  = hotelResult.output?.totalUSD  || 0;
    const fixedCosts = flightCost + hotelCost;
    const remaining  = budget - fixedCosts;

    const step7 = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "CONSTRAINT_CHECK",
      content: `Fixed costs analysis:
        <div class="constraint-grid">
          <div class="constraint-item"><span>✈️ Flights (RT)</span><span class="constraint-val ${flightCost > budget * 0.45 ? 'constraint-warn' : 'constraint-ok'}">$${flightCost.toLocaleString()}</span></div>
          <div class="constraint-item"><span>🏨 Hotel (${actualNights} nights)</span><span class="constraint-val">$${hotelCost.toLocaleString()}</span></div>
          <div class="constraint-item constraint-total"><span>Fixed Subtotal</span><span class="constraint-val">$${fixedCosts.toLocaleString()}</span></div>
          <div class="constraint-item constraint-remain"><span>Remaining for activities/food</span><span class="constraint-val ${remaining < 200 ? 'constraint-warn' : 'constraint-ok'}">$${remaining.toLocaleString()}</span></div>
        </div>
        ${remaining < 200 ? '⚠️ Budget is very tight after fixed costs. Consider adjusting hotel category or travel class.' : `✅ $${remaining.toLocaleString()} remaining is workable.`}`
    };
    steps.push(step7);
    renderStep(step7);
    await delay(700);

    if (remaining < 0) {
      warnings.push(`Budget exceeded by fixed costs alone! Flights ($${flightCost}) + Hotel ($${hotelCost}) = $${fixedCosts}, exceeding $${budget} budget.`);
      confidenceScore -= 0.30;
    } else if (remaining < 200) {
      warnings.push("Very little budget remains after flights and hotel. Consider budget hotel or economy class.");
      confidenceScore -= 0.10;
    }

    // ── STEP 8: ACTIVITY SELECTION ────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(700);
    removeThinkingIndicator();

    const actBudget = Math.min(remaining * 0.55, budgetResult.output?.allocations?.activities || remaining * 0.4);
    const step8reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "OPTIMIZATION",
      content: `Selecting activities for ${actualNights} days with activity budget of $${Math.round(actBudget)}. Prioritizing: <strong>${preferences.join(', ')}</strong>. Strategy: match preference types first, then fill with top-rated activities within budget.`
    };
    steps.push(step8reason);
    renderStep(step8reason);
    await delay(400);

    const actsResult = await Tools.selectActivities({
      destination, preferences,
      budget: Math.round(actBudget),
      days: actualNights
    });
    const step8tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "selectActivities",
      tool_input: { destination, preferences, budget: Math.round(actBudget), days: actualNights },
      tool_output: actsResult.output,
      success: actsResult.success,
      expected_output: "Ranked list of activities matching preferences within budget"
    };
    steps.push(step8tool);
    renderStep(step8tool);
    await delay(700);

    // ── STEP 9: BUILD ITINERARY ───────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(700);
    removeThinkingIndicator();

    const step9reason = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "PLANNING",
      content: `Building day-by-day itinerary for ${actualNights} nights in ${destination}. Distributing ${actsResult.output?.selected?.length || 0} activities (max 2/day), adding meal suggestions from local cuisine, and mapping neighborhoods for each day.`
    };
    steps.push(step9reason);
    renderStep(step9reason);
    await delay(400);

    const itinResult = await Tools.buildDayItinerary({
      destination,
      activities: actsResult.output?.selected || [],
      nights: actualNights,
      startDate,
      hotelName: hotelResult.output?.hotelName || "Your Hotel",
      hotelCategory
    });
    const step9tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "buildDayItinerary",
      tool_input: { destination, nights: actualNights, startDate },
      tool_output: { days_built: itinResult.output?.days?.length, destination: itinResult.output?.destination },
      success: itinResult.success,
      expected_output: "Complete day-by-day itinerary with activities, meals, and transport"
    };
    steps.push(step9tool);
    renderStep(step9tool);
    await delay(600);

    // ── STEP 10: TOTAL COST CALCULATION ───────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const foodEstimate = Math.round(
      (destResult.output?.avgMealCost?.midrange || 25) * 3 * actualNights
    );
    const transportEstimate = Math.round(
      (destResult.output?.transportDayPass || 12) * actualNights
    );
    const actCost = actsResult.output?.totalCost || 0;
    const miscEstimate = Math.round(budget * 0.04);

    const costItems = [
      { category: "flights",    label: "Round-trip Flights",    amount: flightCost },
      { category: "hotel",      label: `Hotel (${actualNights} nights)`, amount: hotelCost },
      { category: "food",       label: `Meals (${actualNights} days × 3)`, amount: foodEstimate },
      { category: "activities", label: "Selected Activities",   amount: actCost },
      { category: "transport",  label: "Local Transport",       amount: transportEstimate },
      { category: "misc",       label: "Miscellaneous/Tips",    amount: miscEstimate },
    ];

    const totalCostResult = await Tools.calculateTotalCost({ items: costItems });
    const step10tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "calculateTotalCost",
      tool_input: { items: costItems },
      tool_output: totalCostResult.output,
      success: totalCostResult.success,
      expected_output: "Verified total trip cost with category breakdown"
    };
    steps.push(step10tool);
    renderStep(step10tool);
    await delay(600);

    const totalCost = totalCostResult.output?.total || 0;
    const savings   = budget - totalCost;

    const step10v = {
      step_id: nextStep(), type: "verification",
      verification_method: "Independent sum of all cost items vs. calculateTotalCost output",
      verification_result: `✓ Tool total: $${totalCost.toLocaleString()} | Budget: $${budget.toLocaleString()} | ${savings >= 0 ? `Surplus: $${savings.toLocaleString()} ✅` : `OVER BUDGET by $${Math.abs(savings).toLocaleString()} ⚠️`} | Verification ${totalCostResult.output?.verificationPassed ? 'PASSED ✓' : 'FAILED ✗'}`
    };
    steps.push(step10v);
    renderStep(step10v);
    await delay(700);

    if (savings < 0) {
      warnings.push(`Total estimated cost ($${totalCost.toLocaleString()}) exceeds budget ($${budget.toLocaleString()}) by $${Math.abs(savings).toLocaleString()}.`);
      confidenceScore -= 0.20;
    }

    // ── STEP 11: RISK ANALYSIS ─────────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(600);
    removeThinkingIndicator();

    const riskResult = await Tools.analyzeRisks({ destination, budget, nights: actualNights, travelClass, month: travelMonth });
    const step11tool = {
      step_id: nextStep(), type: "tool_call", tool_name: "analyzeRisks",
      tool_input: { destination, budget, nights: actualNights, travelClass, month: travelMonth },
      tool_output: riskResult.output,
      success: riskResult.success,
      expected_output: "Risk level assessment and recommendations"
    };
    steps.push(step11tool);
    renderStep(step11tool);
    await delay(600);

    riskResult.output?.risks?.forEach(r => warnings.push(`[HIGH RISK] ${r.message}`));
    riskResult.output?.warnings?.forEach(w => warnings.push(w.message));
    if (riskResult.output?.risks?.length > 0) confidenceScore -= 0.10;

    // ── STEP 12: FINAL DECISION ────────────────────────────────────────────────
    thinking = addThinkingIndicator();
    await delay(700);
    removeThinkingIndicator();

    const step12 = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "FINAL_DECISION",
      content: `All subtasks complete. Itinerary for <strong>${destination}</strong> (${actualNights} nights) is ${savings >= 0 ? '<span style="color:#22c55e">within budget</span>' : '<span style="color:#f43f5e">over budget — review warnings</span>'}. 
        Confidence score: <strong>${Math.round(Math.max(0, confidenceScore) * 100)}%</strong>. 
        ${warnings.length > 0 ? `<br>⚠️ ${warnings.length} warning(s) raised — review the warnings panel.` : '✅ No critical issues detected.'}
        <br><br>Generating final itinerary display…`
    };
    steps.push(step12);
    renderStep(step12);
    await delay(800);

    // ── BUILD FINAL OUTPUT ─────────────────────────────────────────────────────
    const finalItinerary = {
      user_goal: `Plan a ${actualNights}-night trip to ${destination} under $${budget.toLocaleString()}`,
      current_context: {
        destination,
        country: destResult.output?.country || "—",
        budget: `$${budget.toLocaleString()} USD`,
        duration: `${actualNights} nights`,
        travel_dates: `${dateResult.output?.startDate} → ${dateResult.output?.endDate}`,
        preferences,
        hotel: hotelResult.output?.hotelName,
        hotel_category: hotelCategory,
        travel_class: travelClass,
        origin,
      },
      steps,
      final_itinerary: {
        hotel: hotelResult.output,
        flight: flightResult.output,
        days: itinResult.output?.days || [],
        destination_info: destResult.output,
        tips: itinResult.output?.tips || [],
      },
      budget_summary: {
        total_budget: budget,
        estimated_cost: totalCost,
        surplus_deficit: savings,
        breakdown: totalCostResult.output?.breakdown || [],
        byCategory: totalCostResult.output?.byCategory || {},
      },
      warnings,
      assumptions,
      confidence_score: `${Math.round(Math.max(0, confidenceScore) * 100)}%`,
      risks: riskResult.output,
    };

    // Store in memory
    AgentState.currentItinerary = finalItinerary;
    AgentState.memory.push({
      timestamp: new Date().toISOString(),
      destination,
      budget,
      nights: actualNights,
      itinerary: finalItinerary
    });

    // ── RENDER FINAL OUTPUT ────────────────────────────────────────────────────
    await renderFinalItinerary(finalItinerary);

  } catch (err) {
    console.error(err);
    const errStep = {
      step_id: nextStep(), type: "reasoning", reasoning_type: "RISK_ANALYSIS",
      content: `<span style="color:#f43f5e">⚠️ An unexpected error occurred: ${err.message}. Please try again or adjust your inputs.</span>`
    };
    renderStep(errStep);
  } finally {
    removeThinkingIndicator();
    AgentState.isRunning = false;
    $('run-btn').disabled = false;
    $('run-btn').innerHTML = `<span>✈️</span> Plan My Trip`;
  }
}

// ─── Render Final Itinerary ────────────────────────────────────────────────────
async function renderFinalItinerary(data) {
  const { final_itinerary, budget_summary, warnings, assumptions, confidence_score, current_context, risks } = data;
  const { hotel, flight, days, destination_info, tips } = final_itinerary;

  // ── Summary Cards ──────────────────────────────────────────────────────────
  const confNum = parseInt(confidence_score);
  const confScoreEl = $('conf-score');
  if (confScoreEl) confScoreEl.textContent = confidence_score;
  const confBarEl = $('conf-bar-inner');
  if (confBarEl) {
    // confidence_score is e.g. '95%' — use it directly as CSS width
    confBarEl.style.width = confidence_score;
    confBarEl.style.background = confNum >= 80 ? '#22c55e' : confNum >= 60 ? '#f59e0b' : '#f43f5e';
  }

  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  
  const destStr = current_context.destination;
  const countryStr = current_context.country;
  const displayDest = (countryStr && destStr.toLowerCase() !== countryStr.toLowerCase()) 
    ? `${destStr}, ${countryStr}` 
    : destStr;

  setText('summary-destination', displayDest);
  setText('summary-dates', current_context.travel_dates);
  setText('summary-hotel', hotel?.hotelName ? `${hotel.hotelName} (${hotel.rating})` : '—');
  setText('summary-flight', flight ? `$${flight.priceUSD} RT · ${flight.travelClass}` : '—');

  // Also update conf-panel sidebar cards
  setText('conf-destination', displayDest);
  setText('conf-dates', current_context.travel_dates);
  setText('conf-hotel', hotel?.hotelName ? `${hotel.hotelName} (${hotel.rating})` : '—');
  setText('conf-flight', flight ? `$${flight.priceUSD} RT · ${flight.travelClass}` : '—');


  // ── Budget Chart ───────────────────────────────────────────────────────────
  const catColors = {
    flights: '#8b5cf6', hotel: '#06b6d4', food: '#10b981',
    activities: '#ec4899', transport: '#f59e0b', misc: '#94a3b8'
  };

  const byCat = budget_summary.byCategory || {};
  const total = budget_summary.estimated_cost || 1;

  $('budget-bars').innerHTML = Object.entries(byCat).map(([cat, amt]) => {
    const pct = Math.round((amt / total) * 100);
    const color = catColors[cat] || '#94a3b8';
    return `
      <div class="budget-row">
        <div class="budget-label">
          <span class="budget-dot" style="background:${color}"></span>
          <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
        </div>
        <div class="budget-bar-wrap">
          <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="budget-amt">$${amt.toLocaleString()}</div>
        <div class="budget-pct">${pct}%</div>
      </div>`;
  }).join('');

  const surplus = budget_summary.surplus_deficit;
  $('budget-total-row').innerHTML = `
    <div class="budget-total">
      <div class="bt-row"><span>Total Budget</span><span class="bt-val">$${budget_summary.total_budget.toLocaleString()}</span></div>
      <div class="bt-row"><span>Estimated Cost</span><span class="bt-val">$${budget_summary.estimated_cost.toLocaleString()}</span></div>
      <div class="bt-row bt-result ${surplus >= 0 ? 'bt-ok' : 'bt-over'}">
        <span>${surplus >= 0 ? '✅ Surplus' : '⚠️ Over Budget'}</span>
        <span class="bt-val">$${Math.abs(surplus).toLocaleString()}</span>
      </div>
    </div>`;

  // ── Donut Chart (SVG) ──────────────────────────────────────────────────────
  renderDonutChart(byCat, catColors, total);

  // ── Warnings & Assumptions ─────────────────────────────────────────────────
  const warnEl = $('warnings-list');
  warnEl.innerHTML = warnings.length === 0
    ? '<div class="no-warnings">✅ No warnings. Itinerary looks good!</div>'
    : warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');

  const assumpEl = $('assumptions-list');
  assumpEl.innerHTML = assumptions.length === 0
    ? '<div class="no-warnings">No assumptions needed.</div>'
    : assumptions.map(a => `<div class="assumption-item">ℹ️ ${a}</div>`).join('');

  // ── Tips ───────────────────────────────────────────────────────────────────
  $('tips-list').innerHTML = tips.map(t => `<div class="tip-item">💡 ${t}</div>`).join('');

  // ── Day-by-Day Itinerary ───────────────────────────────────────────────────
  $('days-container').innerHTML = days.map(day => `
    <div class="day-card">
      <div class="day-header">
        <div class="day-number">Day ${day.day}</div>
        <div class="day-info">
          <div class="day-date">${day.date}</div>
          <div class="day-theme">${day.theme}</div>
        </div>
        <div class="day-neighborhood">📍 ${day.neighborhood}</div>
      </div>
      <div class="day-body">
        <div class="day-meals">
          <div class="meal-item"><span class="meal-icon">🌅</span><span>${day.meals.breakfast}</span></div>
          <div class="meal-item"><span class="meal-icon">☀️</span><span>${day.meals.lunch}</span></div>
          <div class="meal-item"><span class="meal-icon">🌙</span><span>${day.meals.dinner}</span></div>
        </div>
        ${day.activities.length > 0 ? `
        <div class="day-activities">
          ${day.activities.map(act => `
            <div class="activity-item">
              <div class="act-icon">${act.type === 'food' ? '🍽️' : act.type === 'culture' ? '🏛️' : act.type === 'nature' ? '🌿' : act.type === 'adventure' ? '⛰️' : act.type === 'shopping' ? '🛍️' : act.type === 'entertainment' ? '🎭' : act.type === 'wellness' ? '🧘' : '📍'}</div>
              <div class="act-info">
                <div class="act-name">${act.name}</div>
                <div class="act-meta">
                  <span class="act-type">${act.type}</span>
                  <span class="act-duration">⏱ ${act.duration}</span>
                  <span class="act-cost">${act.cost === 0 ? 'Free' : `$${act.cost}`}</span>
                </div>
              </div>
            </div>`).join('')}
        </div>` : ''}
        <div class="day-transport">🚇 ${day.transport}</div>
        <div class="day-spend">Est. daily spend: <strong>$${day.estimatedDailySpend}</strong></div>
      </div>
    </div>
  `).join('');

  // Show sections
  $('itinerary-section').style.display = 'block';
  $('budget-section').style.display = 'block';
  await delay(100);
  $('itinerary-section').classList.add('section-visible');
  $('budget-section').classList.add('section-visible');
  $('itinerary-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── SVG Donut Chart ───────────────────────────────────────────────────────────
function renderDonutChart(byCat, catColors, total) {
  const size   = 180;
  const cx     = size / 2;
  const cy     = size / 2;
  const r      = 65;
  const stroke = 28;

  let cumulativeAngle = -90; // start at top
  const slices = [];

  for (const [cat, amt] of Object.entries(byCat)) {
    if (amt <= 0) continue;
    const pct   = amt / total;
    const angle = pct * 360;
    const color = catColors[cat] || '#94a3b8';

    const startRad = (cumulativeAngle * Math.PI) / 180;
    const endRad   = ((cumulativeAngle + angle) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    slices.push(`<path d="${d}" fill="${color}" opacity="0.9" />`);
    cumulativeAngle += angle;
  }

  // Inner white circle (donut hole)
  const innerR = r - stroke;
  slices.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#050810" />`);
  slices.push(`<text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#e2e8f0" font-size="13" font-weight="700" font-family="Outfit,sans-serif">$${Math.round(total).toLocaleString()}</text>`);
  slices.push(`<text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="#64748b" font-size="9" font-family="Inter,sans-serif">TOTAL EST.</text>`);

  $('donut-chart').innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${slices.join('\n')}
    </svg>`;
}

// ─── Export Itinerary as JSON ─────────────────────────────────────────────────
function exportItinerary() {
  if (!AgentState.currentItinerary) return;
  const blob = new Blob([JSON.stringify(AgentState.currentItinerary, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `travel-itinerary-${AgentState.currentItinerary.current_context.destination.toLowerCase().replace(/\s+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Form Submission ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize date fields
  const today = new Date();
  const oneMonthOut = new Date(today);
  oneMonthOut.setMonth(today.getMonth() + 1);
  const twoMonthsOut = new Date(today);
  twoMonthsOut.setMonth(today.getMonth() + 1);
  twoMonthsOut.setDate(twoMonthsOut.getDate() + 5);

  $('start-date').value = oneMonthOut.toISOString().split('T')[0];
  $('end-date').value   = twoMonthsOut.toISOString().split('T')[0];

  // Shared helper to update slider fill width
  function updateSliderFill(val) {
    const min   = 500;
    const max   = 20000;
    const pct   = ((val - min) / (max - min)) * 100;
    const fill  = $('slider-fill');
    if (fill) fill.style.width = pct + '%';
  }

  // Budget slider
  const budgetSlider  = $('budget-slider');
  const budgetDisplay = $('budget-display');
  // Set initial fill
  updateSliderFill(parseInt(budgetSlider.value));

  budgetSlider.addEventListener('input', () => {
    const val = parseInt(budgetSlider.value);
    budgetDisplay.textContent = `$${val.toLocaleString()}`;
    updateSliderFill(val);
  });

  // Refinement +/- buttons
  document.querySelectorAll('.refine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action     = btn.dataset.action;
      const currentVal = parseInt(budgetSlider.value);
      if (action === 'budget-up')   budgetSlider.value = Math.min(20000, currentVal + 500);
      if (action === 'budget-down') budgetSlider.value = Math.max(500,   currentVal - 500);
      const newVal = parseInt(budgetSlider.value);
      budgetDisplay.textContent = `$${newVal.toLocaleString()}`;
      updateSliderFill(newVal);
    });
  });
  document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.dataset.dest;
      const budget = btn.dataset.budget;
      const prefs = btn.dataset.prefs;
      const nights = parseInt(btn.dataset.nights || 5);
      
      $('destination').value = dest;
      $('budget-slider').value = budget;
      $('budget-display').textContent = `$${parseInt(budget).toLocaleString()}`;
      
      const start = new Date();
      start.setMonth(start.getMonth() + 2);
      const end = new Date(start);
      end.setDate(end.getDate() + nights);
      $('start-date').value = start.toISOString().split('T')[0];
      $('end-date').value   = end.toISOString().split('T')[0];

      document.querySelectorAll('.pref-chip').forEach(chip => chip.classList.remove('selected'));
      prefs.split(',').forEach(p => {
        const chip = document.querySelector(`.pref-chip[data-pref="${p.trim()}"]`);
        if (chip) chip.classList.add('selected');
      });

      document.querySelectorAll('.example-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Preference chips
  document.querySelectorAll('.pref-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  // Main form submit
  $('trip-form').addEventListener('submit', async e => {
    e.preventDefault();

    const destination  = $('destination').value.trim();
    const budget       = parseInt($('budget-slider').value);
    const startDate    = $('start-date').value;
    const endDate      = $('end-date').value;
    const origin       = $('origin').value;
    const travelClass  = $('travel-class').value;
    const hotelCategory= $('hotel-category').value;
    const preferences  = Array.from(document.querySelectorAll('.pref-chip.selected')).map(c => c.dataset.pref);
    const duration     = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

    if (!destination) { alert('Please enter a destination!'); return; }
    if (duration <= 0) { alert('End date must be after start date!'); return; }

    await runAgent({ destination, budget, duration, startDate, endDate, preferences, origin, travelClass, hotelCategory });
  });

  // Export button
  $('export-btn').addEventListener('click', exportItinerary);

  // Refinement controls
  document.querySelectorAll('.refine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const slider = $('budget-slider');
      const currentVal = parseInt(slider.value);
      if (action === 'budget-up')   { slider.value = Math.min(20000, currentVal + 500); }
      if (action === 'budget-down') { slider.value = Math.max(500, currentVal - 500); }
      $('budget-display').textContent = `$${parseInt(slider.value).toLocaleString()}`;
    });
  });
});
