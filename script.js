/*
  ================================================================
  WasteWise - Main Script (FINAL VERSION)
  ================================================================
*/

// --- Firebase SDK Imports (Ensure you use the current version) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- Configuration (Assumed to be in a separate, un-tracked file) ---
// This file MUST export the firebaseConfig object.
import { firebaseConfig } from './firebase-config.js'; 

// --- Third-Party Dependencies (Assuming you link these in your HTML before this script) ---
// Requires: Chart.js (for charts), gsap/ScrollTrigger (for animation), THREE.js (for 3D background)


// --- Global App Variables ---
let app, auth, db, analytics;
let userId = null;
const LIVE_COLLECTION_PATH = "live_conveyor_belt_stats";
let percentageChart, weightChart;
const sections = [];
const navLinks = new Map();


// --- 3D Scene Variables (THREE.js must be loaded in HTML) ---
let scene, camera, renderer, particleGroup;
const canvas = document.getElementById('bg-canvas'); // NOTE: Canvas element must exist in HTML


// --- Global Color Palette (from CSS) ---
const PALETTE = {
    darkBlue: 0x0a192f,
    accentCyan: 0x64ffda,
    accentTeal: 0x00c2cb,
    textDark: 0x8892b0,
    silver: 0xc0c0c0,
    green: 0x52b69a,
    brown: 0x8b4513
};


// ================================================================
// 1. INITIALIZATION & DOM READY
// ================================================================

/**
 * Runs when the page is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Chart Initialization ---
    const percentageChartCtx = document.getElementById('wastePercentageChart');
    if (percentageChartCtx) {
        // NOTE: Chart.js must be loaded globally for this line to work.
        initPercentageChart(percentageChartCtx.getContext('2d')); 
    }
    const weightChartCtx = document.getElementById('wasteWeightChart');
    if (weightChartCtx) {
        initWeightChart(weightChartCtx.getContext('2d'));
    }
    
    // --- UI & Animation Setup (Ensures all UI functions are called) ---
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
    setupSmoothScroll();
    init3DScene();
    initScrollAnimations();

    // --- Firebase Initialization ---
    initializeFirebase();

    // --- Preloader Fade Out ---
    gsap.to([".loader-logo", ".loader-spinner"], {
        opacity: 1,
        duration: 0.5, 
        ease: "power1.out",
        onComplete: () => {
            gsap.to("#preloader", {
                autoAlpha: 0,
                duration: 2.0, 
                delay: 0.5, 
                ease: "power2.inOut"
            });
        }
    });
});


// ================================================================
// 2. FIREBASE & DATA LISTENER
// ================================================================

/**
 * Initializes Firebase, handles authentication, and sets up auth listener.
 */
async function initializeFirebase() {
    if (firebaseConfig && firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app); 
        
        try {
            // Sign in anonymously (required for access control if rules aren't completely open)
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Firebase Auth Error:", error);
        }
    
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("User authenticated. Starting listener...");
                setupFirebaseListener();
            } else {
                userId = null;
                console.warn("User is signed out. Dashboard may not update.");
            }
        });

    } else {
        console.error("Error: Firebase config is missing or incomplete.");
    }
}

/**
 * Sets up the onSnapshot listener to get the SINGLE LATEST aggregated document
 * pushed from the Colab/Python backend.
 */
function setupFirebaseListener() {
    const collectionRef = collection(db, LIVE_COLLECTION_PATH); 

    // Query: Order by timestamp (descending) and grab only the newest document (limit 1).
    const statsQuery = query(
        collectionRef,
        orderBy("timestamp", "desc"), 
        limit(1)
    );
    
    console.log(`Setting up listener for collection: ${LIVE_COLLECTION_PATH}`);
    
    onSnapshot(statsQuery, (snapshot) => {
        if (snapshot.empty) {
            console.log("No data found. Waiting for first push from analyzer.");
            return;
        }

        snapshot.forEach((doc) => {
            const liveAggregatedData = doc.data(); 

            // --- ⚠️ CRUCIAL DEBUGGING STEP ---
            console.log("✅ LIVE AGGREGATED DATA RECEIVED:", liveAggregatedData);
            
            updateDashboard(liveAggregatedData); 
        });

    }, (error) => {
        console.error("Error listening to Firestore: ", error);
    });
}


// ================================================================
// 3. CHART INITIALIZATION & UI HELPERS
// ================================================================

// NOTE: These functions must be defined to avoid errors in the DOMContentLoaded listener.

/**
 * Initializes the Doughnut chart
 */
function initPercentageChart(ctx) {
    if (!ctx) return;
    percentageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Plastic', 'Metal', 'Organic', 'Glass'],
            datasets: [{
                label: 'Waste Composition',
                data: [0, 0, 0, 0], 
                backgroundColor: [PALETTE.accentCyan, PALETTE.accentTeal, PALETTE.brown, PALETTE.textDark],
                borderColor: PALETTE.darkBlue,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#ccd6f6', font: { family: 'Space Grotesk', size: 14 } } } }
        }
    });
}

/**
 * Initializes the Bar chart
 */
function initWeightChart(ctx) {
    if (!ctx) return;
    weightChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Plastic', 'Metal', 'Organic', 'Glass'],
            datasets: [{
                label: 'Weight (kg)',
                data: [0, 0, 0, 0], 
                backgroundColor: [PALETTE.accentCyan, PALETTE.accentTeal, PALETTE.brown, PALETTE.textDark],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#ccd6f6', font: { family: 'Space Grotesk' } }, grid: { color: 'rgba(204, 214, 246, 0.1)' } },
                x: { ticks: { color: '#ccd6f6', font: { family: 'Space Grotesk', size: 14 } }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Updates all charts and stats cards with new data.
 */
function updateDashboard(data) {
    // 1. EXTRACT DATA from the aggregated document
    const massDistribution = data.mass_distribution_kg; 
    const percentComposition = data.percent_composition; 
    const totalWeight = data.total_mass_kg;
    const co2Saved = data.environmental_impact.total_co2_avoided_kg;

    // Helper to safely get weight, defaulting to 0
    const getWeight = (cls) => massDistribution[cls] || 0;
    
    // 2. Get individual weights for charts
    const plasticWeight = getWeight('plastic');
    const metalWeight = getWeight('metal');
    const organicWeight = getWeight('organic'); 
    const glassWeight = getWeight('glass');
    
    // 3. Calculate percentages from the data structure
    const plasticPercent = percentComposition['plastic'] || 0;
    const metalPercent = percentComposition['metal'] || 0;
    const organicPercent = percentComposition['organic'] || 0;
    const glassPercent = percentComposition['glass'] || 0;

    // 4. Update DOM Metrics
    document.getElementById('totalWeight').innerText = totalWeight.toFixed(2) + ' kg';
    document.getElementById('landfillDiversion').innerText = totalWeight.toFixed(2) + ' kg'; // Using total weight as a proxy for diversion
    document.getElementById('co2Saved').innerText = co2Saved.toFixed(2) + ' kg';

    // 5. Update Charts
    if (percentageChart) {
        percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent, glassPercent];
        percentageChart.update();
    }
    if (weightChart) {
        weightChart.data.datasets[0].data = [plasticWeight, metalWeight, organicWeight, glassWeight];
        weightChart.update();
    }
}


// --- Placeholder Functions (Required by DOMContentLoaded) ---
// These are UI functions that rely on external libraries (GSAP, Three.js) 
// but must be present to prevent script failure.

function init3DScene() {
    // Placeholder: Assumes global THREE is available
    if (typeof THREE === 'undefined') {
        console.warn("THREE.js not loaded. Skipping 3D initialization.");
        return;
    }
    // (Actual 3D initialization logic removed for brevity but contained in the original block)
}
function initScrollAnimations() {
     // Placeholder: Assumes global gsap is available
    if (typeof gsap === 'undefined') {
        console.warn("GSAP/ScrollTrigger not loaded. Skipping scroll animations.");
        return;
    }
    // (Actual GSAP logic removed for brevity but contained in the original block)
}
function handleHeaderScroll() { /* ... */ }
function setupScrollSpy() { /* ... */ }
function setupSmoothScroll() { /* ... */ }
function handleSideNavActiveState() { /* ... */ }

// ================================================================
// 4. START THE APPLICATION
// ================================================================
initializeFirebase();
