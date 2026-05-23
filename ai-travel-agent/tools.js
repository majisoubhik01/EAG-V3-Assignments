// ============================================================
// tools.js — LLM-Powered Tool Library for the Travel Planning Agent
// ============================================================

/**
 * All tool functions return a standardized result object:
 * {
 *   tool: string,
 *   input: object,
 *   output: any,
 *   success: boolean,
 *   error?: string,
 *   timestamp: string
 * }
 */

const Tools = (() => {

  function _result(tool, input, output, success = true, error = null) {
    return { tool, input, output, success, error, timestamp: new Date().toISOString() };
  }

  // Helper to call the local LLM Gateway
  async function callLLM(systemPrompt, userPrompt, schema) {
    const response = await fetch('http://localhost:8099/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt + " Output strictly in JSON format." },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_schema", schema_: schema },
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.parsed || JSON.parse(data.text);
  }

  // ─── 1. Flight Search ──────────────────────────────────────────────────────
  async function flightSearch({ origin = "US", destination, travelClass = "economy", month }) {
    try {
      const schema = {
        type: "object",
        properties: {
          found: { type: "boolean" },
          priceUSD: { type: "integer" },
          roundTrip: { type: "boolean" },
          travelClass: { type: "string" },
          estimatedDuration: { type: "string" },
          seasonalNote: { type: "string" },
          stops: { type: "string" },
          airline: { type: "string" }
        },
        required: ["found", "priceUSD", "roundTrip", "travelClass", "estimatedDuration", "seasonalNote", "stops", "airline"]
      };

      const system = `You are a travel booking engine. Estimate realistic round-trip flight details.`;
      const user = `Estimate a round-trip ${travelClass} flight from ${origin} to ${destination} in ${month || 'the near future'}. Provide realistic pricing in USD and standard airline options.`;

      const result = await callLLM(system, user, schema);
      return _result("flightSearch", { origin, destination, travelClass, month }, result);
    } catch (e) {
      return _result("flightSearch", { origin, destination, travelClass, month }, null, false, e.message);
    }
  }

  // ─── 2. Hotel Search ───────────────────────────────────────────────────────
  async function hotelSearch({ destination, category = "midrange", nights }) {
    try {
      const schema = {
        type: "object",
        properties: {
          found: { type: "boolean" },
          hotelName: { type: "string" },
          pricePerNight: { type: "integer" },
          totalUSD: { type: "integer" },
          nights: { type: "integer" },
          category: { type: "string" },
          rating: { type: "string" },
          amenities: { type: "array", items: { type: "string" } },
          neighborhood: { type: "string" },
          cancellationPolicy: { type: "string" }
        },
        required: ["found", "hotelName", "pricePerNight", "totalUSD", "nights", "category", "rating", "amenities", "neighborhood", "cancellationPolicy"]
      };

      const system = `You are a hotel booking engine. Generate a realistic hotel option for the given category. Make sure totalUSD = pricePerNight * nights.`;
      const user = `Find a ${category} hotel in ${destination} for ${nights} nights. Give a specific real-sounding hotel name, typical per-night cost in USD, and key amenities.`;

      const result = await callLLM(system, user, schema);
      return _result("hotelSearch", { destination, category, nights }, result);
    } catch (e) {
      return _result("hotelSearch", { destination, category, nights }, null, false, e.message);
    }
  }

  // ─── 3. Currency Converter ─────────────────────────────────────────────────
  // Kept as synchronous logic since it's just math, but wrapped in async for consistency.
  // We can use LLM for exchange rate lookup for real-time-ish data.
  async function currencyConvert({ amount, from, to = "USD" }) {
    try {
      const schema = {
        type: "object",
        properties: {
          original: { type: "number" },
          fromCurrency: { type: "string" },
          toCurrency: { type: "string" },
          exchangeRate: { type: "number" },
          convertedAmount: { type: "number" },
          formula: { type: "string" }
        },
        required: ["original", "fromCurrency", "toCurrency", "exchangeRate", "convertedAmount", "formula"]
      };

      const system = `You are a currency converter. Provide current approximate exchange rates.`;
      const user = `Convert ${amount} ${from} to ${to}. Provide the approximate current exchange rate and the final converted amount.`;

      const result = await callLLM(system, user, schema);
      return _result("currencyConvert", { amount, from, to }, result);
    } catch (e) {
      return _result("currencyConvert", { amount, from, to }, null, false, e.message);
    }
  }

  // ─── 4. Budget Allocation ──────────────────────────────────────────────────
  // Math logic is best kept deterministic, so this stays local.
  async function calculateBudgetAllocation({ totalBudget, preferences = [], nights = 5 }) {
    const BUDGET_TEMPLATES = {
      balanced:  { flights: 0.35, hotel: 0.35, food: 0.15, activities: 0.10, transport: 0.03, misc: 0.02 },
      food:      { flights: 0.30, hotel: 0.30, food: 0.30, activities: 0.05, transport: 0.03, misc: 0.02 },
      culture:   { flights: 0.30, hotel: 0.35, food: 0.15, activities: 0.15, transport: 0.03, misc: 0.02 },
      adventure: { flights: 0.30, hotel: 0.30, food: 0.15, activities: 0.20, transport: 0.03, misc: 0.02 },
      luxury:    { flights: 0.25, hotel: 0.45, food: 0.20, activities: 0.05, transport: 0.03, misc: 0.02 },
      budget:    { flights: 0.45, hotel: 0.25, food: 0.15, activities: 0.05, transport: 0.05, misc: 0.05 }
    };

    let template = { ...BUDGET_TEMPLATES.balanced };
    preferences.forEach(pref => {
      const p = pref.toLowerCase();
      if (p.includes('food') || p.includes('eat')) template = { ...BUDGET_TEMPLATES.food };
      else if (p.includes('cultur') || p.includes('museum') || p.includes('art')) template = { ...BUDGET_TEMPLATES.culture };
      else if (p.includes('adventur') || p.includes('outdoor')) template = { ...BUDGET_TEMPLATES.adventure };
      else if (p.includes('luxur') || p.includes('spa')) template = { ...BUDGET_TEMPLATES.luxury };
      else if (p.includes('budget') || p.includes('cheap')) template = { ...BUDGET_TEMPLATES.budget };
    });

    const allocation = {};
    let total = 0;
    for (const [cat, pct] of Object.entries(template)) {
      allocation[cat] = Math.round(totalBudget * pct);
      total += allocation[cat];
    }
    allocation.misc += totalBudget - total;

    return _result("calculateBudgetAllocation", { totalBudget, preferences, nights }, {
      template: preferences.length ? preferences[0].toLowerCase() : "balanced",
      allocations: allocation,
      totalVerified: Object.values(allocation).reduce((s, v) => s + v, 0),
      perDay: {
        hotel: Math.round(allocation.hotel / nights),
        food: Math.round(allocation.food / nights),
        activities: Math.round(allocation.activities / nights),
        transport: Math.round(allocation.transport / nights),
      },
      percentages: template
    });
  }

  // ─── 5. Date Validator ─────────────────────────────────────────────────────
  async function validateDateRange({ startDate, endDate }) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const now   = new Date();

    if (isNaN(start) || isNaN(end)) {
      return _result("validateDateRange", { startDate, endDate }, null, false, "Invalid date format.");
    }

    const nights  = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const daysUntilTrip = Math.round((start - now) / (1000 * 60 * 60 * 24));
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = MONTHS[start.getMonth()];

    return _result("validateDateRange", { startDate, endDate }, {
      valid: nights > 0,
      startDate: start.toDateString(),
      endDate:   end.toDateString(),
      nights,
      daysFromToday: daysUntilTrip,
      month,
      isPastDate: start < now,
      warning: start < now ? "Start date is in the past." : nights > 30 ? "Trip exceeds 30 nights — verify hotel availability." : null,
      peakSeason: ["December", "January", "July", "August"].includes(month)
    });
  }

  // ─── 6. Destination Info ───────────────────────────────────────────────────
  async function getDestinationInfo({ destination }) {
    try {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          country: { type: "string" },
          description: { type: "string" },
          bestSeason: { type: "string" },
          currency: { type: "string" },
          language: { type: "string" },
          timezone: { type: "string" },
          cuisine: { type: "array", items: { type: "string" } },
          neighborhoods: { type: "array", items: { type: "string" } },
          visaFree: { type: "boolean" },
          safetyRating: { type: "string" },
          internetQuality: { type: "string" },
          electricalPlug: { type: "string" }
        },
        required: ["name", "country", "description", "bestSeason", "currency", "language", "timezone", "cuisine", "neighborhoods", "visaFree", "safetyRating", "internetQuality", "electricalPlug"]
      };

      const system = `You are a travel Wikipedia. Provide accurate factual information about the destination.`;
      const user = `Give me a comprehensive travel overview for ${destination}, including currency, language, top cuisines, and electrical plug type.`;

      const result = await callLLM(system, user, schema);
      return _result("getDestinationInfo", { destination }, result);
    } catch (e) {
      return _result("getDestinationInfo", { destination }, null, false, e.message);
    }
  }

  // ─── 7. Activity Selector ──────────────────────────────────────────────────
  async function selectActivities({ destination, preferences = [], budget, days }) {
    try {
      const schema = {
        type: "object",
        properties: {
          selected: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string" },
                cost: { type: "integer" },
                duration: { type: "string" },
                description: { type: "string" }
              },
              required: ["name", "type", "cost", "duration", "description"]
            }
          },
          totalCost: { type: "integer" },
          remainingBudget: { type: "integer" },
          activitiesPerDay: { type: "integer" },
          preferenceMatch: { type: "integer" }
        },
        required: ["selected", "totalCost", "remainingBudget", "activitiesPerDay", "preferenceMatch"]
      };

      const maxActivities = days * 2;
      const system = `You are a travel concierge. Create an itinerary of activities. Ensure the total cost of all activities does NOT exceed the provided budget limit.`;
      const user = `Generate up to ${maxActivities} specific activities in ${destination} tailored to these preferences: ${preferences.join(', ')}. The total combined cost must be under $${budget}. Include real-sounding tours, museums, or dining experiences.`;

      const result = await callLLM(system, user, schema);
      return _result("selectActivities", { destination, preferences, budget, days }, result);
    } catch (e) {
      return _result("selectActivities", { destination, preferences, budget, days }, null, false, e.message);
    }
  }

  // ─── 8. Total Cost Calculator ──────────────────────────────────────────────
  async function calculateTotalCost({ items }) {
    if (!Array.isArray(items)) {
      return _result("calculateTotalCost", { items }, null, false, "Items must be an array.");
    }
    const breakdown = items.map(item => ({
      category: item.category || "misc",
      label: item.label || "Unknown",
      amount: Number(item.amount) || 0
    }));
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const verifiedTotal = breakdown.map(i => i.amount).reduce((a, b) => a + b, 0);

    return _result("calculateTotalCost", { items }, {
      breakdown,
      total: Math.round(total * 100) / 100,
      verifiedTotal: Math.round(verifiedTotal * 100) / 100,
      verificationPassed: Math.abs(total - verifiedTotal) < 0.01,
      byCategory: breakdown.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.amount;
        return acc;
      }, {})
    });
  }

  // ─── 9. Distance Calculator ────────────────────────────────────────────────
  async function calculateDistance({ from, to }) {
    try {
      const schema = {
        type: "object",
        properties: {
          found: { type: "boolean" },
          distanceKm: { type: "integer" },
          distanceMiles: { type: "integer" },
          flightTime: { type: "string" },
          trainTime: { type: "string" },
          recommendedTransport: { type: "string" }
        },
        required: ["found", "distanceKm", "distanceMiles", "flightTime", "trainTime", "recommendedTransport"]
      };

      const system = `You are a geography routing engine. Estimate the distance between two cities accurately.`;
      const user = `Calculate the direct flight distance between ${from} and ${to} in kilometers. Provide estimated flight and train times.`;

      const result = await callLLM(system, user, schema);
      return _result("calculateDistance", { from, to }, result);
    } catch (e) {
      return _result("calculateDistance", { from, to }, null, false, e.message);
    }
  }

  // ─── 10. Build Day-by-Day Itinerary ───────────────────────────────────────
  async function buildDayItinerary({ destination, activities, nights, startDate, hotelName, hotelCategory }) {
    try {
      const schema = {
        type: "object",
        properties: {
          destination: { type: "string" },
          country: { type: "string" },
          hotel: { type: "string" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "integer" },
                date: { type: "string" },
                theme: { type: "string" },
                neighborhood: { type: "string" },
                activities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string" },
                      duration: { type: "string" },
                      cost: { type: "integer" }
                    },
                    required: ["name", "type", "duration", "cost"]
                  }
                },
                meals: {
                  type: "object",
                  properties: {
                    breakfast: { type: "string" },
                    lunch: { type: "string" },
                    dinner: { type: "string" }
                  },
                  required: ["breakfast", "lunch", "dinner"]
                },
                transport: { type: "string" },
                estimatedDailySpend: { type: "integer" }
              },
              required: ["day", "date", "theme", "neighborhood", "activities", "meals", "transport", "estimatedDailySpend"]
            }
          },
          totalActivityCost: { type: "integer" },
          currency: { type: "string" },
          language: { type: "string" },
          timezone: { type: "string" },
          tips: { type: "array", items: { type: "string" } }
        },
        required: ["destination", "country", "hotel", "days", "totalActivityCost", "currency", "language", "timezone", "tips"]
      };

      const system = `You are an expert trip planner. Distribute the provided activities logically across the days. Suggest realistic local meals.`;
      const user = `Create a ${nights}-night day-by-day itinerary for ${destination} starting on ${startDate}. We are staying at ${hotelName} (${hotelCategory}).
      Please schedule these exact activities across the days: ${JSON.stringify(activities.map(a => ({name: a.name, type: a.type, cost: a.cost, duration: a.duration}))) }.
      Do not add new paid activities, just schedule the ones provided, plus free exploration and meals.`;

      const result = await callLLM(system, user, schema);
      return _result("buildDayItinerary", { destination, nights }, result);
    } catch (e) {
      return _result("buildDayItinerary", { destination, nights }, null, false, e.message);
    }
  }

  // ─── 11. Risk Analyzer ────────────────────────────────────────────────────
  async function analyzeRisks({ destination, budget, nights, travelClass, month }) {
    try {
      const schema = {
        type: "object",
        properties: {
          risks: { type: "array", items: { type: "object", properties: { level: { type: "string" }, message: { type: "string" } } } },
          warnings: { type: "array", items: { type: "object", properties: { level: { type: "string" }, message: { type: "string" } } } },
          overallRiskLevel: { type: "string" },
          recommendedEmergencyFund: { type: "integer" },
          travelInsuranceRecommended: { type: "boolean" }
        },
        required: ["risks", "warnings", "overallRiskLevel", "recommendedEmergencyFund", "travelInsuranceRecommended"]
      };

      const system = `You are a travel risk analyst. Identify any seasonal, financial, or cultural risks for the trip.`;
      const user = `Analyze the travel risks for a ${nights}-night trip to ${destination} in ${month} with a total budget of $${budget} flying ${travelClass}. Mention weather, peak season, budget constraints, or cultural rules.`;

      const result = await callLLM(system, user, schema);
      return _result("analyzeRisks", { destination, budget, nights, travelClass, month }, result);
    } catch (e) {
      return _result("analyzeRisks", { destination, budget, nights, travelClass, month }, null, false, e.message);
    }
  }

  // Public API
  return {
    flightSearch,
    hotelSearch,
    currencyConvert,
    calculateBudgetAllocation,
    validateDateRange,
    getDestinationInfo,
    selectActivities,
    calculateTotalCost,
    calculateDistance,
    buildDayItinerary,
    analyzeRisks
  };

})();
