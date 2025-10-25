// --- CHART.JS AND DATA SIMULATION ---

let percentageChart, weightChart;

// This runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // --- HEADER SCROLL LOGIC ---
    const header = document.getElementById('header');
    if (header) {
        // Check if we are on the home page (which has the 'home' hero section)
        if (document.getElementById('home')) {
            // Only add scroll listener on the home page
            window.addEventListener('scroll', handleHeaderScroll);
        } else {
            // On other pages (like about.html), make the header solid from the start
            header.classList.add('scrolled');
        }
    }

    // --- SMOOTH SCROLL LOGIC ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // Get the full URL path of the link and the current page
            const linkPath = new URL(this.href, window.location.origin).pathname;
            const currentPath = window.location.pathname;

            // Only smooth scroll if the link is on the *current* page
            if (linkPath === currentPath && this.hash !== "") {
                e.preventDefault(); // Stop the default jump
                const targetElement = document.querySelector(this.hash);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
            // If the link goes to another page (e.g., index.html#dashboard from about.html),
            // the browser will handle the navigation normally.
        });
    });


    // --- CHART INITIALIZATION ---
    // Only try to create charts if the canvas elements exist on the page
    const percentageChartCtx = document.getElementById('wastePercentageChart');
    if (percentageChartCtx) {
        initPercentageChart(percentageChartCtx.getContext('2d'));
    }

    const weightChartCtx = document.getElementById('wasteWeightChart');
    if (weightChartCtx) {
        initWeightChart(weightChartCtx.getContext('2d'));
    }
    
    // Start simulation *only* if both charts were initialized
    if (percentageChart && weightChart) {
        setInterval(simulateDataUpdate, 3000); // Update every 3 seconds
    }
});

/**
 * Adds a 'scrolled' class to the header when user scrolls
 */
function handleHeaderScroll() {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
}

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
                    '#1A936F', // var(--color-green)
                    '#114B5F', // var(--color-dark-blue)
                    '#88D498'  // var(--color-light-green)
                ],
                borderColor: '#F3E9D2', // var(--color-cream)
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#114B5F', // var(--color-dark-blue)
                        font: {
                            family: 'Inter',
                            size: 14
                        }
                    }
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
                    '#1A936F', // var(--color-green)
                    '#114B5F', // var(--color-dark-blue)
                    '#88D498'  // var(--color-light-green)
                ],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#114B5F',
                        font: { family: 'Inter' }
                    },
                    grid: {
                        color: 'rgba(17, 75, 95, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#114B5F',
                        font: { family: 'Inter', size: 14 }
                    },
                    grid: {
                        display: false
                    }
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
    currentCo2Saved = (runningPlasticTotal * 2.5) + (runningMetalTotal * 1.8) + (runningOrganicTotal * 0.1); 

    const newData = {
        plasticWeight: runningPlasticTotal,
        metalWeight: runningMetalTotal, 
        organicWeight: runningOrganicTotal, 
        totalWeight: currentTotalWeight,
        landfillDiversion: currentLandfillDiversion,
        co2Saved: currentCo2Saved
    };
    
    updateDashboard(newData);
}

/**
 * Updates all charts and stats cards with new data.
 */
function updateDashboard(data) {
    const totalForPercent = data.totalWeight > 0 ? data.totalWeight : 1;
    const plasticPercent = (data.plasticWeight / totalForPercent) * 100;
    const metalPercent = (data.metalWeight / totalForPercent) * 100;
    const organicPercent = (data.organicWeight / totalForPercent) * 100;

    // --- Update Stats Cards ---
    document.getElementById('totalWeight').innerText = data.totalWeight.toFixed(2) + ' kg';
    document.getElementById('landfillDiversion').innerText = data.landfillDiversion.toFixed(2) + ' kg';
    document.getElementById('co2Saved').innerText = data.co2Saved.toFixed(2) + ' kg';

    // --- Update Percentage Chart ---
    if (percentageChart) {
        percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent];
        percentageChart.update();
    }

    // --- Update Weight Chart ---
    if (weightChart) {
        weightChart.data.datasets[0].data = [data.plasticWeight, data.metalWeight, data.organicWeight];
        weightChart.update();
    }
}

