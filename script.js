// --- CHART.JS AND DATA SIMULATION ---

let percentageChart, weightChart;

// This runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize charts with empty data
    initPercentageChart();
    initWeightChart();
    
    // Start the "live" data simulation
    // In your real project, you would replace this with a WebSocket or fetch() call
    // that gets data from your ML model's API endpoint.
    setInterval(simulateDataUpdate, 3000); // Update every 3 seconds
});

/**
 * Initializes the Doughnut chart for waste percentages
 */
function initPercentageChart() {
    const ctx = document.getElementById('wastePercentageChart').getContext('2d');
    percentageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Plastic', 'Metal', 'Organic'],
            datasets: [{
                label: 'Waste Composition',
                data: [0, 0, 0], // Start with 0
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(107, 114, 128, 0.8)', // Gray
                    'rgba(22, 163, 74, 0.8)'   // Green
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(107, 114, 128, 1)',
                    'rgba(22, 163, 74, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

/**
 * Initializes the Bar chart for waste weights
 */
function initWeightChart() {
    const ctx = document.getElementById('wasteWeightChart').getContext('2d');
    weightChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Plastic', 'Metal', 'Organic'],
            datasets: [{
                label: 'Weight (kg)',
                data: [0, 0, 0], // Start with 0
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(107, 114, 128, 0.8)', // Gray
                    'rgba(22, 163, 74, 0.8)'   // Green
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(107, 114, 128, 1)',
                    'rgba(22, 163, 74, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false // Hide legend for bar chart
                }
            }
        }
    });
}

/**
 * --- HACKATHON DEMO: DATA SIMULATION ---
 * This function simulates new data coming from your ML model.
 * * TO-DO FOR YOUR TEAM:
 * 1. Create an API endpoint (e.g., using Flask/FastAPI in Python) that
 * your ML model sends data to (e.g., {"plastic": 1.2, "metal": 0.5, "organic": 3.0}).
 * 2. Replace the contents of this function with a `fetch()` call to that endpoint.
 * 3. Call the `updateDashboard` function with the real data.
 */
let currentTotalWeight = 0;
let currentLandfillDiversion = 0;
let currentCo2Saved = 0;
let runningPlasticTotal = 0;
let runningMetalTotal = 0;
let runningOrganicTotal = 0;

function simulateDataUpdate() {
    // Generate random weights for one "batch" of trash
    const plastic = Math.random() * 2; // 0-2 kg
    const metal = Math.random() * 1;   // 0-1 kg
    const organic = Math.random() * 3; // 0-3 kg

    // Add to totals
    runningPlasticTotal += plastic;
    runningMetalTotal += metal;
    runningOrganicTotal += organic;
    
    currentTotalWeight = runningPlasticTotal + runningMetalTotal + runningOrganicTotal;
    
    // Simple 1:1 diversion for all waste processed
    currentLandfillDiversion = currentTotalWeight; 
    
    // Example multipliers for CO2 saved
    // These would be based on research (e.g., "saving 2.5kg of CO2 per kg of plastic recycled")
    currentCo2Saved = (runningPlasticTotal * 2.5) + (runningMetalTotal * 1.8) + (runningOrganicTotal * 0.1); 

    // This is the data object your real API should provide
    const newData = {
        plasticWeight: runningPlasticTotal,
        metalWeight: runningMetalTotal, 
        organicWeight: runningOrganicTotal, 
        totalWeight: currentTotalWeight,
        landfillDiversion: currentLandfillDiversion,
        co2Saved: currentCo2Saved
    };
    
    // Pass the simulated data to the update function
    updateDashboard(newData);
}

/**
 * Updates all charts and stats cards with new data.
 * @param {object} data - The data from your API.
 * Example: { plasticWeight: 10.5, metalWeight: 5.2, organicWeight: 20.1, totalWeight: 35.8, ... }
 */
function updateDashboard(data) {
    // Calculate percentages
    // Avoid division by zero if total is 0
    const totalForPercent = data.totalWeight > 0 ? data.totalWeight : 1;
    const plasticPercent = (data.plasticWeight / totalForPercent) * 100;
    const metalPercent = (data.metalWeight / totalForPercent) * 100;
    const organicPercent = (data.organicWeight / totalForPercent) * 100;

    // --- Update Stats Cards ---
    document.getElementById('totalWeight').innerText = data.totalWeight.toFixed(2) + ' kg';
    document.getElementById('landfillDiversion').innerText = data.landfillDiversion.toFixed(2) + ' kg';
    document.getElementById('co2Saved').innerText = data.co2Saved.toFixed(2) + ' kg';

    // --- Update Percentage Chart ---
    percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent];
    percentageChart.update();

    // --- Update Weight Chart ---
    weightChart.data.datasets[0].data = [data.plasticWeight, data.metalWeight, data.organicWeight];
    weightChart.update();
}
