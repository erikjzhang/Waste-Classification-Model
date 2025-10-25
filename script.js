/*
  ================================================================
  Project Sort(Ed) - Main Dashboard Script
  
  This script READS from Firebase to update charts.
  ================================================================
*/

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBL0k6AE5NBpVOQPEEGsKRMc48yDuEGonc",
    authDomain: "ai-waste-classification-d07a6.firebaseapp.com",
    projectId: "ai-waste-classification-d07a6",
    storageBucket: "ai-waste-classification-d07a6.firebasestorage.app",
    messagingSenderId: "512015830235",
    appId: "1:512015830235:web:cb0f09269ff5b9e8d010fe",
    measurementId: "G-4T8NKD7K74"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const dbCollection = collection(db, "classifications"); // Database "folder"

// --- REMOVED Teachable Machine variables ---

// --- Global Variables ---
let percentageChart, weightChart;
const sections = [];
const navLinks = new Map();

// This runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // --- HEADER SCROLL LOGIC ---
    const header = document.getElementById('header');
    if (header) {
        if (document.getElementById('home')) {
            window.addEventListener('scroll', handleHeaderScroll);
            setupScrollSpy();
            window.addEventListener('scroll', handleSideNavActiveState);
        } else {
            header.classList.add('scrolled');
        }
    }

    // --- SMOOTH SCROLL LOGIC ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const linkPath = new URL(this.href, window.location.origin).pathname;
            const currentPath = window.location.pathname;

            if (linkPath === currentPath && this.hash !== "") {
                e.preventDefault();
                const targetElement = document.querySelector(this.hash);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // --- CHART INITIALIZATION ---
    const percentageChartCtx = document.getElementById('wastePercentageChart');
    if (percentageChartCtx) {
        initPercentageChart(percentageChartCtx.getContext('2d'));
    }

    const weightChartCtx = document.getElementById('wasteWeightChart');
    if (weightChartCtx) {
        initWeightChart(weightChartCtx.getContext('2d'));
    }
    
    // --- FIREBASE LISTENER ---
    // This will now work because `onSnapshot` is imported
    if (percentageChart && weightChart) {
        setupFirebaseListener();
    }
});

/**
 * Adds a 'scrolled' class to the header when user scrolls
 */
function handleHeaderScroll() {
    // ... (This function is unchanged)
    const header = document.getElementById('header');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
}

// --- Functions for Side-Nav Scroll Spy ---
function setupScrollSpy() {
    const sideNav = document.querySelector('.side-nav');
    if (!sideNav) return;

    // Clear previous state just in case
    sections.length = 0; 
    navLinks.clear();

    sideNav.querySelectorAll('.side-nav-link').forEach(link => {
        const sectionId = link.dataset.section;
        const section = document.getElementById(sectionId);
        if (section) {
            sections.push(section);
            navLinks.set(section, link);
        }
    });

    // Ensure sections are sorted by their position in the document
    sections.sort((a, b) => a.offsetTop - b.offsetTop);
}

function handleSideNavActiveState() {
    if (sections.length === 0) return;

    let currentSection = null;
    // A slightly smaller offset can prevent 'flashing' between sections
    // or when the scroll is near the top of the section.
    const headerOffset = 80; 

    // Find the section that is currently in view (or just above the offset)
    for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (window.scrollY >= section.offsetTop - headerOffset) {
            currentSection = section;
            break; // Found the lowest section that's been scrolled past
        }
    }

    // If no section is past the offset (i.e., we are at the very top of the page), 
    // the first section should be active if it exists.
    if (!currentSection && sections.length > 0) {
        currentSection = sections[0];
    }

    // Apply the active class
    navLinks.forEach((link, section) => {
        if (section === currentSection) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- FIREBASE REAL-TIME LISTENER ---
/**
 * Sets up the onSnapshot listener to get live data from Firestore
 * and update the dashboard.
 */
function setupFirebaseListener() {
    console.log("Setting up Firebase listener...");
    
    // This function runs every time data changes in the 'classifications' collection
    onSnapshot(dbCollection, (querySnapshot) => {
        console.log("Received data from Firebase:", querySnapshot.size, "items");
        
        let totalWeight = 0;
        let plasticWeight = 0;
        let metalWeight = 0;
        let organicWeight = 0;

        // Loop through every single document in the collection
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            if (data.weight_kg) {
                totalWeight += data.weight_kg;
                
                // Make sure these names ("Plastic", "Metal") MATCH
                // your Teachable Machine class names!
                switch (data.type) {
                    case 'Plastic':
                        plasticWeight += data.weight_kg;
                        break;
                    case 'Metal':
                        metalWeight += data.weight_kg;
                        break;
                    case 'Organic':
                        organicWeight += data.weight_kg;
                        break;
                }
            }
        });

        // Now calculate the derived stats
        const landfillDiversion = totalWeight; 
        const co2Saved = (plasticWeight * 2.5) + (metalWeight * 1.8) + (organicWeight * 0.1); 

        const dashboardData = {
            plasticWeight: plasticWeight,
            metalWeight: metalWeight, 
            organicWeight: organicWeight, 
            totalWeight: totalWeight,
            landfillDiversion: landfillDiversion,
            co2Saved: co2Saved
        };
        
        updateDashboard(dashboardData);

    }, (error) => {
        console.error("Error listening to Firestore: ", error);
    });
}


/**
 * Initializes the Doughnut chart for waste percentages
 */
function initPercentageChart(ctx) {
    percentageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Plastic', 'Metal', 'Organic'],
            datasets: [{
                label: 'Waste Composition',
                data: [0, 0, 0],
                backgroundColor: ['#52b69a', '#184e77', '#76c893'],
                borderColor: '#d9ed92',
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
                        color: '#184e77',
                        font: { family: 'Space Grotesk', size: 14 }
                    }
                }
            }
        }
    });
}

/**
 * Initializes the Bar chart for waste weights
 */
function initWeightChart(ctx) {
    weightChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Plastic', 'Metal', 'Organic'],
            datasets: [{
                label: 'Weight (kg)',
                data: [0, 0, 0],
                backgroundColor: ['#52b69a', '#184e77', '#76c893'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#184e77', font: { family: 'Space Grotesk' } },
                    grid: { color: 'rgba(24, 78, 119, 0.1)' }
                },
                x: {
                    ticks: { color: '#184e77', font: { family: 'Space Grotesk', size: 14 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Updates all charts and stats cards with new data.
 */
function updateDashboard(data) {
    const totalForPercent = data.totalWeight > 0 ? data.totalWeight : 1;
    
    const plasticPercent = (data.plasticWeight / totalForPercent) * 100;
    const metalPercent = (data.metalWeight / totalForPercent) * 100;
    const organicPercent = (data.organicWeight / totalForPercent) * 100;

    document.getElementById('totalWeight').innerText = data.totalWeight.toFixed(2) + ' kg';
    document.getElementById('landfillDiversion').innerText = data.landfillDiversion.toFixed(2) + ' kg';
    document.getElementById('co2Saved').innerText = data.co2Saved.toFixed(2) + ' kg';

    if (percentageChart) {
        percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent];
        percentageChart.update();
    }

    if (weightChart) {
        weightChart.data.datasets[0].data = [data.plasticWeight, data.metalWeight, data.organicWeight];
        weightChart.update();
    }
}

