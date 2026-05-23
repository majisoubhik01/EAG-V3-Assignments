// ============================================================
// data.js — Static knowledge base for the Travel Planning Agent
// ============================================================

const DESTINATIONS = {
  tokyo: {
    name: "Tokyo",
    country: "Japan",
    currency: "JPY",
    timezone: "JST (UTC+9)",
    language: "Japanese",
    bestSeason: "March–May, Sept–Nov",
    coords: { lat: 35.6762, lng: 139.6503 },
    highlights: ["Shibuya Crossing", "Senso-ji Temple", "Akihabara", "Tsukiji Market", "Shinjuku Gyoen", "teamLab Planets", "Harajuku", "Mount Fuji day-trip"],
    cuisine: ["Ramen", "Sushi", "Tempura", "Yakitori", "Wagyu Beef", "Matcha desserts"],
    neighborhoods: ["Shinjuku", "Shibuya", "Asakusa", "Harajuku", "Akihabara", "Ginza"],
    avgHotelPerNight: { budget: 60, midrange: 130, luxury: 350 },
    avgMealCost: { cheap: 8, midrange: 25, fancy: 80 },
    transportDayPass: 12,
    topActivities: [
      { name: "teamLab Planets Digital Art", cost: 32, duration: "2-3h", type: "culture" },
      { name: "Senso-ji Temple & Nakamise", cost: 0, duration: "2h", type: "culture" },
      { name: "Shibuya Crossing & Observation", cost: 15, duration: "2h", type: "sightseeing" },
      { name: "Akihabara Electronics & Anime Tour", cost: 20, duration: "3h", type: "shopping" },
      { name: "Mount Fuji Day Trip", cost: 45, duration: "full day", type: "nature" },
      { name: "Tsukiji Outer Market Food Tour", cost: 30, duration: "2h", type: "food" },
      { name: "Ramen Museum Ikebukuro", cost: 12, duration: "2h", type: "food" },
      { name: "Harajuku Takeshita Street", cost: 0, duration: "1.5h", type: "culture" },
      { name: "Shinjuku Gyoen Garden", cost: 4, duration: "2h", type: "nature" },
      { name: "Sumo Morning Practice", cost: 0, duration: "2h", type: "culture" },
    ]
  },
  paris: {
    name: "Paris",
    country: "France",
    currency: "EUR",
    timezone: "CET (UTC+1)",
    language: "French",
    bestSeason: "April–June, Sept–Oct",
    coords: { lat: 48.8566, lng: 2.3522 },
    highlights: ["Eiffel Tower", "Louvre Museum", "Montmartre", "Seine River Cruise", "Versailles", "Musée d'Orsay", "Sainte-Chapelle", "Le Marais"],
    cuisine: ["Croissants", "Escargot", "Coq au Vin", "Macarons", "Crêpes", "French Onion Soup"],
    neighborhoods: ["Le Marais", "Montmartre", "Saint-Germain", "Champs-Élysées", "Latin Quarter"],
    avgHotelPerNight: { budget: 80, midrange: 180, luxury: 500 },
    avgMealCost: { cheap: 15, midrange: 40, fancy: 120 },
    transportDayPass: 14,
    topActivities: [
      { name: "Eiffel Tower (Summit)", cost: 29, duration: "2h", type: "sightseeing" },
      { name: "Louvre Museum", cost: 22, duration: "4h", type: "culture" },
      { name: "Seine River Cruise", cost: 18, duration: "1.5h", type: "sightseeing" },
      { name: "Palace of Versailles", cost: 22, duration: "full day", type: "culture" },
      { name: "Montmartre & Sacré-Cœur", cost: 0, duration: "3h", type: "culture" },
      { name: "Musée d'Orsay", cost: 16, duration: "3h", type: "culture" },
      { name: "Sainte-Chapelle", cost: 13, duration: "1.5h", type: "culture" },
      { name: "Cooking Class French Cuisine", cost: 90, duration: "3h", type: "food" },
      { name: "Le Marais Jewish Quarter Walk", cost: 0, duration: "2h", type: "culture" },
      { name: "Moulin Rouge Show", cost: 115, duration: "2.5h", type: "entertainment" },
    ]
  },
  bali: {
    name: "Bali",
    country: "Indonesia",
    currency: "IDR",
    timezone: "WITA (UTC+8)",
    language: "Balinese/Indonesian",
    bestSeason: "April–Oct",
    coords: { lat: -8.3405, lng: 115.0920 },
    highlights: ["Tanah Lot Temple", "Ubud Monkey Forest", "Rice Terraces", "Seminyak Beach", "Kuta", "Mount Batur Sunrise", "Uluwatu Cliff Temple"],
    cuisine: ["Nasi Goreng", "Babi Guling", "Satay", "Gado-Gado", "Jamu", "Fresh tropical fruits"],
    neighborhoods: ["Seminyak", "Ubud", "Kuta", "Canggu", "Uluwatu", "Sanur"],
    avgHotelPerNight: { budget: 20, midrange: 70, luxury: 250 },
    avgMealCost: { cheap: 5, midrange: 15, fancy: 40 },
    transportDayPass: 8,
    topActivities: [
      { name: "Tegallalang Rice Terrace", cost: 3, duration: "2h", type: "nature" },
      { name: "Ubud Monkey Forest", cost: 5, duration: "2h", type: "nature" },
      { name: "Mount Batur Sunrise Trek", cost: 40, duration: "full day", type: "adventure" },
      { name: "Tanah Lot Temple Sunset", cost: 4, duration: "2h", type: "culture" },
      { name: "Kecak Fire Dance at Uluwatu", cost: 10, duration: "2h", type: "culture" },
      { name: "Balinese Cooking Class", cost: 35, duration: "4h", type: "food" },
      { name: "Surfing Lesson at Kuta", cost: 25, duration: "2h", type: "adventure" },
      { name: "White Water Rafting Ayung", cost: 35, duration: "3h", type: "adventure" },
      { name: "Traditional Spa & Massage", cost: 20, duration: "2h", type: "wellness" },
      { name: "Sacred Monkey Forest Walk", cost: 5, duration: "1.5h", type: "nature" },
    ]
  },
  newyork: {
    name: "New York City",
    country: "United States",
    currency: "USD",
    timezone: "EST (UTC-5)",
    language: "English",
    bestSeason: "April–June, Sept–Nov",
    coords: { lat: 40.7128, lng: -74.0060 },
    highlights: ["Central Park", "Times Square", "Statue of Liberty", "Brooklyn Bridge", "The Met", "High Line", "9/11 Memorial", "Broadway"],
    cuisine: ["NY Pizza", "Bagels", "Cheesecake", "Pastrami Sandwich", "Dim Sum in Chinatown", "Hot Dogs"],
    neighborhoods: ["Manhattan", "Brooklyn", "SoHo", "Greenwich Village", "Harlem", "Upper East Side"],
    avgHotelPerNight: { budget: 100, midrange: 250, luxury: 600 },
    avgMealCost: { cheap: 15, midrange: 45, fancy: 120 },
    transportDayPass: 15,
    topActivities: [
      { name: "Statue of Liberty & Ellis Island", cost: 24, duration: "4h", type: "sightseeing" },
      { name: "The Metropolitan Museum of Art", cost: 30, duration: "4h", type: "culture" },
      { name: "Empire State Building Observatory", cost: 44, duration: "2h", type: "sightseeing" },
      { name: "Broadway Show", cost: 120, duration: "3h", type: "entertainment" },
      { name: "Brooklyn Bridge Walk", cost: 0, duration: "1.5h", type: "sightseeing" },
      { name: "Central Park Guided Tour", cost: 25, duration: "2h", type: "nature" },
      { name: "9/11 Memorial & Museum", cost: 33, duration: "3h", type: "culture" },
      { name: "High Line Park Walk", cost: 0, duration: "2h", type: "nature" },
      { name: "One World Observatory", cost: 38, duration: "2h", type: "sightseeing" },
      { name: "Food Tour in Manhattan", cost: 65, duration: "3h", type: "food" },
    ]
  },
  rome: {
    name: "Rome",
    country: "Italy",
    currency: "EUR",
    timezone: "CET (UTC+1)",
    language: "Italian",
    bestSeason: "April–June, Sept–Oct",
    coords: { lat: 41.9028, lng: 12.4964 },
    highlights: ["Colosseum", "Vatican Museums", "Trevi Fountain", "Roman Forum", "Pantheon", "Borghese Gallery", "Trastevere"],
    cuisine: ["Cacio e Pepe", "Carbonara", "Suppli", "Gelato", "Tiramisu", "Pizza al Taglio"],
    neighborhoods: ["Trastevere", "Prati", "Testaccio", "Parioli", "Centro Storico"],
    avgHotelPerNight: { budget: 60, midrange: 150, luxury: 400 },
    avgMealCost: { cheap: 12, midrange: 35, fancy: 90 },
    transportDayPass: 10,
    topActivities: [
      { name: "Colosseum & Roman Forum", cost: 18, duration: "4h", type: "culture" },
      { name: "Vatican Museums & Sistine Chapel", cost: 27, duration: "4h", type: "culture" },
      { name: "Trevi Fountain & Pantheon Walk", cost: 0, duration: "2h", type: "sightseeing" },
      { name: "Borghese Gallery", cost: 15, duration: "2h", type: "culture" },
      { name: "Trastevere Evening Food Walk", cost: 40, duration: "3h", type: "food" },
      { name: "Cooking Class Roman Pasta", cost: 75, duration: "3h", type: "food" },
      { name: "Vatican Castel Sant'Angelo", cost: 15, duration: "2h", type: "culture" },
      { name: "Catacombs Tour", cost: 13, duration: "2h", type: "culture" },
      { name: "Piazza Navona & Campo de Fiori", cost: 0, duration: "2h", type: "sightseeing" },
      { name: "Day Trip to Pompeii", cost: 55, duration: "full day", type: "culture" },
    ]
  },
  sydney: {
    name: "Sydney",
    country: "Australia",
    currency: "AUD",
    timezone: "AEST (UTC+10)",
    language: "English",
    bestSeason: "Sept–Nov, March–May",
    coords: { lat: -33.8688, lng: 151.2093 },
    highlights: ["Sydney Opera House", "Harbour Bridge", "Bondi Beach", "The Rocks", "Blue Mountains", "Taronga Zoo", "Manly Beach"],
    cuisine: ["Meat Pie", "Tim Tams", "Barramundi", "Lamingtons", "Smashed Avo", "Flat White"],
    neighborhoods: ["The Rocks", "Darling Harbour", "Newtown", "Surry Hills", "Bondi", "Manly"],
    avgHotelPerNight: { budget: 90, midrange: 200, luxury: 500 },
    avgMealCost: { cheap: 15, midrange: 40, fancy: 100 },
    transportDayPass: 18,
    topActivities: [
      { name: "Sydney Opera House Tour", cost: 42, duration: "1.5h", type: "culture" },
      { name: "Harbour Bridge Climb", cost: 180, duration: "3h", type: "adventure" },
      { name: "Bondi Beach & Coastal Walk", cost: 0, duration: "3h", type: "nature" },
      { name: "Blue Mountains Day Trip", cost: 60, duration: "full day", type: "nature" },
      { name: "Taronga Zoo", cost: 50, duration: "4h", type: "nature" },
      { name: "Manly Ferry & Beach", cost: 12, duration: "3h", type: "nature" },
      { name: "The Rocks Ghost Tour", cost: 35, duration: "2h", type: "entertainment" },
      { name: "Snorkeling at Clovelly", cost: 0, duration: "2h", type: "adventure" },
      { name: "Royal Botanic Garden", cost: 0, duration: "2h", type: "nature" },
      { name: "Paddington Markets", cost: 0, duration: "2h", type: "shopping" },
    ]
  },
  dubai: {
    name: "Dubai",
    country: "UAE",
    currency: "AED",
    timezone: "GST (UTC+4)",
    language: "Arabic/English",
    bestSeason: "Nov–March",
    coords: { lat: 25.2048, lng: 55.2708 },
    highlights: ["Burj Khalifa", "Palm Jumeirah", "Dubai Mall", "Desert Safari", "Dubai Frame", "Gold Souk", "Marina"],
    cuisine: ["Shawarma", "Hummus", "Machboos", "Luqaimat", "Al Harees", "Camel Milk"],
    neighborhoods: ["Downtown Dubai", "Dubai Marina", "JBR", "Deira", "Palm Jumeirah", "Al Fahidi"],
    avgHotelPerNight: { budget: 70, midrange: 180, luxury: 600 },
    avgMealCost: { cheap: 10, midrange: 35, fancy: 100 },
    transportDayPass: 8,
    topActivities: [
      { name: "Burj Khalifa (At the Top)", cost: 45, duration: "2h", type: "sightseeing" },
      { name: "Desert Safari with BBQ Dinner", cost: 70, duration: "6h", type: "adventure" },
      { name: "Dubai Frame", cost: 14, duration: "1.5h", type: "sightseeing" },
      { name: "Palm Jumeirah & Atlantis", cost: 0, duration: "3h", type: "sightseeing" },
      { name: "Dubai Creek & Gold Souk", cost: 0, duration: "3h", type: "culture" },
      { name: "Skydiving over Palm Jumeirah", cost: 500, duration: "4h", type: "adventure" },
      { name: "Hot Air Balloon Desert", cost: 200, duration: "4h", type: "adventure" },
      { name: "Aquaventure Waterpark", cost: 85, duration: "full day", type: "entertainment" },
      { name: "Dubai Museum & Heritage Village", cost: 3, duration: "2h", type: "culture" },
      { name: "Dhow Cruise Marina", cost: 50, duration: "2h", type: "sightseeing" },
    ]
  },
  barcelona: {
    name: "Barcelona",
    country: "Spain",
    currency: "EUR",
    timezone: "CET (UTC+1)",
    language: "Spanish/Catalan",
    bestSeason: "May–June, Sept–Oct",
    coords: { lat: 41.3851, lng: 2.1734 },
    highlights: ["Sagrada Família", "Park Güell", "Las Ramblas", "Gothic Quarter", "Camp Nou", "Barceloneta Beach", "Montjuïc"],
    cuisine: ["Paella", "Tapas", "Pan con Tomate", "Croquetas", "Patatas Bravas", "Sangria"],
    neighborhoods: ["Gothic Quarter", "Eixample", "Barceloneta", "Gràcia", "Born", "Poble Sec"],
    avgHotelPerNight: { budget: 65, midrange: 150, luxury: 400 },
    avgMealCost: { cheap: 12, midrange: 30, fancy: 90 },
    transportDayPass: 11,
    topActivities: [
      { name: "Sagrada Família (Towers)", cost: 38, duration: "2.5h", type: "culture" },
      { name: "Park Güell Monumental Zone", cost: 13, duration: "2h", type: "culture" },
      { name: "Gothic Quarter Walking Tour", cost: 25, duration: "2.5h", type: "culture" },
      { name: "Camp Nou Stadium Tour", cost: 28, duration: "2h", type: "entertainment" },
      { name: "Barceloneta Beach & Waterfront", cost: 0, duration: "3h", type: "nature" },
      { name: "Montjuïc Cable Car & Castle", cost: 15, duration: "3h", type: "sightseeing" },
      { name: "Tapas & Wine Tour", cost: 60, duration: "3h", type: "food" },
      { name: "Picasso Museum", cost: 14, duration: "2h", type: "culture" },
      { name: "Flamenco Show", cost: 45, duration: "1.5h", type: "entertainment" },
      { name: "Day Trip to Sitges", cost: 20, duration: "full day", type: "nature" },
    ]
  }
};

// ─── Flight pricing matrix (USD round-trip estimates) ─────────────────────────
const FLIGHT_PRICES = {
  "US-tokyo":      { economy: 900,  business: 3200 },
  "US-paris":      { economy: 650,  business: 2800 },
  "US-bali":       { economy: 1100, business: 3800 },
  "US-newyork":    { economy: 0,    business: 0    },  // domestic
  "US-rome":       { economy: 700,  business: 2900 },
  "US-sydney":     { economy: 1300, business: 4500 },
  "US-dubai":      { economy: 800,  business: 3000 },
  "US-barcelona":  { economy: 680,  business: 2750 },
  "UK-tokyo":      { economy: 750,  business: 2800 },
  "UK-paris":      { economy: 80,   business: 450  },
  "UK-bali":       { economy: 900,  business: 3200 },
  "UK-newyork":    { economy: 550,  business: 2200 },
  "UK-rome":       { economy: 120,  business: 550  },
  "UK-sydney":     { economy: 1100, business: 4000 },
  "UK-dubai":      { economy: 600,  business: 2400 },
  "UK-barcelona":  { economy: 90,   business: 480  },
  "IN-tokyo":      { economy: 700,  business: 2600 },
  "IN-paris":      { economy: 580,  business: 2400 },
  "IN-bali":       { economy: 350,  business: 1500 },
  "IN-newyork":    { economy: 900,  business: 3500 },
  "IN-rome":       { economy: 550,  business: 2200 },
  "IN-sydney":     { economy: 800,  business: 3000 },
  "IN-dubai":      { economy: 250,  business: 1000 },
  "IN-barcelona":  { economy: 560,  business: 2300 },
  "AU-tokyo":      { economy: 800,  business: 2800 },
  "AU-paris":      { economy: 1100, business: 4000 },
  "AU-bali":       { economy: 400,  business: 1600 },
  "AU-newyork":    { economy: 1200, business: 4500 },
  "AU-rome":       { economy: 1050, business: 3900 },
  "AU-sydney":     { economy: 0,    business: 0    }, // domestic
  "AU-dubai":      { economy: 850,  business: 3200 },
  "AU-barcelona":  { economy: 1080, business: 3950 },
};

// ─── Currency exchange rates (to USD) ─────────────────────────────────────────
const EXCHANGE_RATES = {
  USD: 1.00,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  AUD: 0.65,
  AED: 0.27,
  IDR: 0.000063,
  INR: 0.012,
  SGD: 0.74,
  CAD: 0.74,
};

// ─── Budget allocation templates by preference ────────────────────────────────
const BUDGET_TEMPLATES = {
  food: {
    flights: 0.28, hotel: 0.22, food: 0.28, activities: 0.12, transport: 0.06, misc: 0.04
  },
  culture: {
    flights: 0.28, hotel: 0.20, food: 0.18, activities: 0.24, transport: 0.06, misc: 0.04
  },
  adventure: {
    flights: 0.28, hotel: 0.18, food: 0.15, activities: 0.28, transport: 0.07, misc: 0.04
  },
  luxury: {
    flights: 0.25, hotel: 0.38, food: 0.20, activities: 0.10, transport: 0.05, misc: 0.02
  },
  budget: {
    flights: 0.35, hotel: 0.18, food: 0.20, activities: 0.15, transport: 0.08, misc: 0.04
  },
  balanced: {
    flights: 0.28, hotel: 0.25, food: 0.20, activities: 0.17, transport: 0.06, misc: 0.04
  }
};

// ─── Distance matrix (km between major cities) ────────────────────────────────
const DISTANCES = {
  "tokyo-paris":      9720,
  "tokyo-bali":       5770,
  "tokyo-newyork":   10840,
  "tokyo-rome":       9870,
  "tokyo-sydney":     7823,
  "tokyo-dubai":      7931,
  "tokyo-barcelona":  10200,
  "paris-bali":      11920,
  "paris-newyork":    5840,
  "paris-rome":       1108,
  "paris-sydney":    16960,
  "paris-dubai":      5250,
  "paris-barcelona":   830,
  "bali-newyork":    15530,
  "bali-rome":       11630,
  "bali-sydney":      4660,
  "bali-dubai":       6300,
  "bali-barcelona":  12500,
  "newyork-rome":     6900,
  "newyork-sydney":  16230,
  "newyork-dubai":   11020,
  "newyork-barcelona": 6375,
  "rome-sydney":     16250,
  "rome-dubai":       3890,
  "rome-barcelona":   1357,
  "sydney-dubai":    11790,
  "sydney-barcelona":17190,
  "dubai-barcelona":  5140,
};

// ─── Month name lookup ─────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Export everything
if (typeof module !== 'undefined') {
  module.exports = { DESTINATIONS, FLIGHT_PRICES, EXCHANGE_RATES, BUDGET_TEMPLATES, DISTANCES, MONTHS };
}
