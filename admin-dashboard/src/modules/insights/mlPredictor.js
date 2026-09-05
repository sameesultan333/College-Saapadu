// ML demand-prediction helpers extracted verbatim from
// AdminDashboard.jsx (performMLAnalysis and its supporting functions).
// Pure functions only — no React state here; the caller (pages/AdminDashboard.jsx)
// stores the returned predictions/performanceMetrics in state.
//
// NOTE (pre-existing behavior, not part of this refactor): these are
// simplified heuristic stand-ins named after ML techniques (random forest,
// LSTM, moving average) rather than real trained models. Left unchanged
// per the "extraction only, no behavior changes" scope of this refactor.

function randomForestPredictor(itemData, features) {
  const trees = 10;
  let predictions = [];
  for (let i = 0; i < trees; i++) {
    const prediction = decisionTree(itemData, features, i);
    predictions.push(prediction);
  }
  return predictions.reduce((a, b) => a + b, 0) / predictions.length;
}

function decisionTree(itemData, features, seed) {
  const { avgSales, dayOfWeek, isHoliday } = features;
  let prediction = avgSales;
  if (dayOfWeek === 0 || dayOfWeek === 6) prediction *= 0.7;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) prediction *= 1.2;
  if (isHoliday) prediction *= 0.3;
  const variance = Math.sin(seed) * 0.1 + 1;
  return Math.max(0, Math.round(prediction * variance));
}

function lstmPredictor(historicalSales) {
  if (historicalSales.length < 7) return null;
  const sequence = historicalSales.slice(-7);
  const weights = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.3];
  let prediction = 0;
  sequence.forEach((value, idx) => {
    prediction += value * weights[idx];
  });
  const trend = calculateTrend(sequence);
  prediction *= 1 + trend;
  return Math.max(0, Math.round(prediction));
}

function calculateTrend(sequence) {
  if (sequence.length < 2) return 0;
  const firstHalf = sequence.slice(0, Math.floor(sequence.length / 2));
  const secondHalf = sequence.slice(Math.floor(sequence.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  return (secondAvg - firstAvg) / Math.max(firstAvg, 1);
}

function movingAveragePredictor(historicalSales, window = 7) {
  if (historicalSales.length < window) {
    return historicalSales.reduce((a, b) => a + b, 0) / historicalSales.length;
  }
  const recent = historicalSales.slice(-window);
  return Math.round(recent.reduce((a, b) => a + b, 0) / window);
}

function extractHistoricalSales(itemName, orderHistory) {
  const salesByDay = {};
  orderHistory.forEach((order) => {
    const date = new Date(order.created_at).toISOString().split("T")[0];
    order.items.forEach((item) => {
      if (item.name === itemName) {
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += item.quantity;
      }
    });
  });
  return Object.values(salesByDay);
}

function calculateConfidence(historicalSales) {
  if (historicalSales.length < 3) return "Low";
  if (historicalSales.length < 7) return "Medium";
  const mean = historicalSales.reduce((a, b) => a + b, 0) / historicalSales.length;
  const variance =
    historicalSales.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalSales.length;
  const stdDev = Math.sqrt(variance);
  const cvCoefficient = stdDev / Math.max(mean, 1);
  if (cvCoefficient < 0.3) return "High";
  if (cvCoefficient < 0.6) return "Medium";
  return "Low";
}

function calculateWasteReduction(currentStock, mlPrediction, baselinePrediction) {
  const currentWaste = Math.max(0, currentStock - baselinePrediction);
  const mlWaste = Math.max(0, currentStock - mlPrediction);
  if (currentWaste === 0) return 0;
  const reduction = ((currentWaste - mlWaste) / currentWaste) * 100;
  return Math.max(0, Math.min(100, Math.round(reduction)));
}

function calculatePerformanceMetrics(predictions) {
  const totalItems = predictions.length;
  const avgWasteReduction = predictions.reduce((sum, p) => sum + p.wasteReduction, 0) / totalItems;
  const totalWastePrevented = predictions.reduce((sum, p) => {
    return sum + Math.max(0, p.currentStock - p.recommendedStock);
  }, 0);
  const totalSavings = predictions.reduce((sum, p) => sum + p.potentialLoss, 0);

  return {
    avgWasteReduction: Math.round(avgWasteReduction),
    totalWastePrevented: Math.round(totalWastePrevented),
    totalSavings: Math.round(totalSavings),
    highConfidencePredictions: predictions.filter((p) => p.confidence === "High").length,
  };
}

// Runs the full analysis over the current menu + order history and
// returns { predictions, performanceMetrics }, matching what
// `performMLAnalysis` used to compute (it previously called the two
// `set...` state updaters directly; the caller now does that).
export function analyzeMenuPredictions(menuItems, orderHistory) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isHoliday = dayOfWeek === 0 || dayOfWeek === 6;

  const predictions = menuItems.map((item) => {
    const historicalSales = extractHistoricalSales(item.name, orderHistory);
    const avgSales =
      historicalSales.length > 0
        ? historicalSales.reduce((a, b) => a + b, 0) / historicalSales.length
        : 5;

    const features = { avgSales, dayOfWeek, isHoliday };
    const rfPrediction = randomForestPredictor(item, features);
    const lstmPrediction = lstmPredictor(historicalSales);
    const maPrediction = movingAveragePredictor(historicalSales);
    const primaryPrediction = historicalSales.length > 30 ? lstmPrediction || rfPrediction : rfPrediction;
    const estimatedWaste = Math.max(0, item.stock - primaryPrediction);
    const wastePercentage = item.stock > 0 ? (estimatedWaste / item.stock) * 100 : 0;
    const potentialLoss = estimatedWaste * item.price;
    const wasteReduction = calculateWasteReduction(item.stock, primaryPrediction, maPrediction);

    return {
      name: item.name,
      currentStock: item.stock,
      avgDailySales: Math.round(avgSales * 10) / 10,
      recommendedStock: primaryPrediction,
      estimatedWaste: Math.round(estimatedWaste * 10) / 10,
      wastePercentage: Math.round(wastePercentage * 10) / 10,
      potentialLoss: Math.round(potentialLoss * 100) / 100,
      confidence: calculateConfidence(historicalSales),
      wasteReduction: wasteReduction,
      riskLevel: wastePercentage > 30 ? "high" : wastePercentage > 15 ? "medium" : "low",
    };
  });

  const performanceMetrics = calculatePerformanceMetrics(predictions);

  return { predictions, performanceMetrics };
}
