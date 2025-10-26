/*
  ================================================================
  WasteWise - Main Script (FINAL VERSION)
  
  - Implements asset-aware loading:
    1. DOMContentLoaded: Fades IN preloader.
    2. window.load: Initializes app (3D, Firebase, Charts) 
       and Fades OUT preloader.
  ================================================================
*/

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- Configuration ---
import { firebaseConfig } from './firebase-config.js'; 

// --- Global App Variables ---
let app, auth, db, analytics;
let userId = null;
const LIVE_COLLECTION_PATH = "live_conveyor_belt_stats";
let percentageChart, weightChart;
const sections = [];
const navLinks = new Map();

// --- 3D Scene Variables ---
let scene, camera, renderer, particleGroup;
const canvas = document.getElementById('bg-canvas');

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

// Colors for Chart.js (must be CSS strings)
const CHART_COLORS = {
    plastic: '#64ffda',   // accentCyan
    metal:   '#00c2cb',   // accentTeal
    organic: '#8b4513',   // brown  ← not black anymore
    glass:   '#8892b0',   // textDark
    border:  '#0a192f'    // darkBlue
};


// ================================================================
// 1. ASSET LOAD & INITIALIZATION
// ================================================================

/**
 * Purpose: fade IN preloader
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Preloader Fade In ---
    gsap.to([".loader-logo", ".loader-spinner"], {
        opacity: 1,
        duration: 0.5, 
        ease: "power1.out"
    });
});


window.addEventListener('load', () => {
    
    // --- Chart Initialization ---
    const percentageChartCtx = document.getElementById('wastePercentageChart');
    if (percentageChartCtx) {
        initPercentageChart(percentageChartCtx.getContext('2d')); 
    }
    const weightChartCtx = document.getElementById('wasteWeightChart');
    if (weightChartCtx) {
        initWeightChart(weightChartCtx.getContext('2d'));
    }
    
    // --- UI & Animation Setup ---
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

    gsap.to("#preloader", {
        autoAlpha: 0,
        duration: 2.0, 
        delay: 0.5, 
        ease: "power2.inOut"
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
    const statsQuery = query(collectionRef); 
    
    console.log(`Setting up COUNT AGGREGATION listener for collection: ${LIVE_COLLECTION_PATH}`);
    
    onSnapshot(statsQuery, (snapshot) => {
        if (snapshot.empty) {
            console.log("No data found. Waiting for first push from analyzer.");
          
            updateDashboard({ 
                total_items: 0, 
                item_distribution_count: {}, 
                percent_composition: {},
                total_co2_avoided: 0, 
                aggCO2_by_category: {} 
            });
            return;
        }

        // --- NEW AGGREGATION LOGIC (FOR COUNTS) ---
        
        let aggTotalItems = 0;
        let aggCounts = { plastic: 0, metal: 0, organic: 0, glass: 0 };
        let docCount = 0;
        let aggCO2 = { plastic: 0, metal: 0, organic: 0, glass: 0 };
        let totalAggCO2 = 0;
        let skippedDocs = 0; 

        console.log(`Snapshot received, processing ${snapshot.size} documents...`); 

        snapshot.forEach((doc) => {
            docCount++;
            const data = doc.data(); 

            // --- ADDED: CRITICAL DEBUGGING LOG ---
            // This will show you EXACTLY what data structure is in Firestore
            if (docCount === 1) { 
                console.log("FIRST DOCUMENT DATA:", JSON.stringify(data, null, 2));
            }
            
            if (data && data.item_distribution_count) { 
                
                // --- 1. Aggregate Item Counts (for Bar Chart) ---
                const plasticCount = data.item_distribution_count.plastic || 0;
                const metalCount = data.item_distribution_count.metal   || 0;
                const organicCount = data.item_distribution_count.organic || 0;
                const glassCount = data.item_distribution_count.glass   || 0;

                // --- FIX: Calculate total_items manually from counts ---
                const docTotalItems = plasticCount + metalCount + organicCount + glassCount;
                
                aggTotalItems += docTotalItems; 
                aggCounts.plastic += plasticCount;
                aggCounts.metal   += metalCount;
                aggCounts.organic += organicCount;
                aggCounts.glass   += glassCount;

                // --- 2. Aggregate CO2 (for Doughnut Chart) ---
                // Prorate the doc's total CO2 based on its item counts
                if (data.environmental_impact && docTotalItems > 0) { // <<< FIX
                    const docCO2 = data.environmental_impact.total_co2_avoided_kg || 0;
                    const avgCO2PerItem = docCO2 / docTotalItems; // <<< FIX

                    aggCO2.plastic += avgCO2PerItem * plasticCount;
                    aggCO2.metal   += avgCO2PerItem * metalCount;
                    aggCO2.organic += avgCO2PerItem * organicCount;
                    aggCO2.glass   += avgCO2PerItem * glassCount;
                    
                    totalAggCO2 += docCO2; 
                }

            } else {

                skippedDocs++;
            }
        });


        if (docCount > 0 && skippedDocs === docCount) {
            console.warn(`WARNING: Processed ${docCount} documents, but SKIPPED ALL OF THEM.`);
            console.warn(`Check your 'FIRST DOCUMENT DATA' log. The code is looking for a field named 'item_distribution_count', but it's not finding it.`);
        }

        // 3. Calculate new percentages based on CO2 contribution
        const totalCO2ForPercent = totalAggCO2 > 0 ? totalAggCO2 : 1; 
        let aggPercent = { 
            plastic: Math.round((aggCO2.plastic / totalCO2ForPercent) * 100),
            metal:   Math.round((aggCO2.metal   / totalCO2ForPercent) * 100),
            organic: Math.round((aggCO2.organic / totalCO2ForPercent) * 100),
            glass:   Math.round((aggCO2.glass   / totalCO2ForPercent) * 100)
        };

        // 4. Build the final aggregated object
        // **** MODIFIED THIS OBJECT ****
        const finalAggregatedData = {
            total_items: aggTotalItems,
            item_distribution_count: aggCounts,
            percent_composition: aggPercent,
            total_co2_avoided: totalAggCO2,
            aggCO2_by_category: aggCO2 
        };

        console.log("✅ AGGREGATED COUNT DATA:", finalAggregatedData);
        updateDashboard(finalAggregatedData); 

    }, (error) => {
        console.error("Error listening to Firestore: ", error);
    });
}


// ================================================================
// 3. CHART INITIALIZATION & DASHBOARD UPDATE
// ================================================================

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
                label: 'CO2 Avoided (by %)',
                data: [0, 0, 0, 0], 
                rawCO2: [0, 0, 0, 0],
                backgroundColor: [  CHART_COLORS.plastic,
                                    CHART_COLORS.metal,
                                    CHART_COLORS.organic,
                                    CHART_COLORS.glass  ],
                borderColor: CHART_COLORS.border,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#ccd6f6', 
                        font: { family: 'Playfair Display', size: 14 } 
                    } 
                },

                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const percent = context.parsed;
                            
                            const rawCO2 = context.dataset.rawCO2[context.dataIndex];

                            const percentString = `${percent}%`;
                            const co2String = `${rawCO2.toFixed(2)} kg CO2 Avoided`;
                            
                            return [label, percentString, co2String];
                        }
                    }
                }
            }
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

                label: 'Item Count', 
                data: [0, 0, 0, 0], 
                backgroundColor: [
                    CHART_COLORS.plastic,
                    CHART_COLORS.metal,
                    CHART_COLORS.organic,
                    CHART_COLORS.glass
                ],
                borderColor: CHART_COLORS.border,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    
                    title: {
                        display: true,
                        text: 'Total Items Detected',
                        color: '#ccd6f6',
                        font: { family: 'Playfair Display' }
                    },
                    ticks: { color: '#ccd6f6', font: { family: 'Playfair Display' } }, 
                    grid: { color: 'rgba(204, 214, 246, 0.1)' } 
                },
                x: { ticks: { color: '#ccd6f6', font: { family: 'Playfair Display', size: 14 } }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Updates all charts and stats cards with new data from the aggregated document.
 */
function updateDashboard(data) {
    // 1. EXTRACT NEW DATA
    const counts = data.item_distribution_count || {}; 
    const percentComposition = data.percent_composition || {}; 
    const totalItems = data.total_items || 0;
    const totalCO2 = data.total_co2_avoided || 0;
    const co2ByCat = data.aggCO2_by_category || {}; 

    // Helper to safely get count, defaulting to 0
    const getCount = (cls) => counts[cls] || 0;
    
    // 2. Get individual counts for charts
    const plasticCount = getCount('plastic');
    const metalCount = getCount('metal');
    const organicCount = getCount('organic'); 
    const glassCount = getCount('glass');
    
    // 3. Get percentages
    const plasticPercent = percentComposition['plastic'] || 0;
    const metalPercent = percentComposition['metal'] || 0;
    const organicPercent = percentComposition['organic'] || 0;
    const glassPercent = percentComposition['glass'] || 0;

    // --- NEW: Get raw CO2 values ---
    const plasticCO2 = co2ByCat['plastic'] || 0;
    const metalCO2 = co2ByCat['metal'] || 0;
    const organicCO2 = co2ByCat['organic'] || 0;
    const glassCO2 = co2ByCat['glass'] || 0;

    // 4. Update DOM Metrics (REMOVED old ones)
    // Assumes you have a new HTML element with id="totalItems"
    document.getElementById('totalItems').innerText = totalItems; 
    document.getElementById('totalCO2').innerText = totalCO2.toFixed(2) + ' kg';


    // 5. Update Charts
    if (percentageChart) {
        // This chart still works, as percentages are still valid
        percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent, glassPercent];
        // --- NEW: Attach raw CO2 data to the dataset ---
        percentageChart.data.datasets[0].rawCO2 = [plasticCO2, metalCO2, organicCO2, glassCO2];
        percentageChart.update();
    }
    if (weightChart) {
        // This now updates with COUNTS instead of WEIGHTS
        weightChart.data.datasets[0].data = [plasticCount, metalCount, organicCount, glassCount];
        weightChart.update();
    }
}


// ================================================================
// 4. 3D SCENE & ANIMATION (THREE.js & GSAP)
// ================================================================

/**
 * Initializes the main Three.js scene
 */
function init3DScene() {
    if (typeof THREE === 'undefined') {
        console.warn("THREE.js not loaded. Skipping 3D initialization.");
        return;
    }
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PALETTE.darkBlue, 5, 25);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Create a group to hold all particles
    particleGroup = new THREE.Group();
    createWasteParticles();
    scene.add(particleGroup);

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Start render loop
    animate();
}

/**
 * Creates the THEMED "waste" particles
 */
function createWasteParticles() {
    const particleCount = 150;
    
    const canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16);
    const bottleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 16);
    const organicGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const geometries = [canGeo, bottleGeo, organicGeo];

    const canMat = new THREE.MeshStandardMaterial({ color: PALETTE.silver, metalness: 0.8, roughness: 0.3 });
    const bottleMat = new THREE.MeshStandardMaterial({ color: PALETTE.green, roughness: 0.1, transparent: true, opacity: 0.8 });
    const organicMat = new THREE.MeshStandardMaterial({ color: PALETTE.brown, roughness: 0.8 });
    const materials = [canMat, bottleMat, organicMat];

    for (let i = 0; i < particleCount; i++) {
        const typeIndex = Math.floor(Math.random() * 3);
        const geo = geometries[typeIndex];
        const mat = materials[typeIndex];
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        particleGroup.add(mesh);
    }
}

/**
 * Handles window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * The main animation loop (requestAnimationFrame)
 */
function animate() {
    requestAnimationFrame(animate);
    if (particleGroup) {
        particleGroup.rotation.x += 0.0005;
        particleGroup.rotation.y += 0.001;
    }
    renderer.render(scene, camera);
}

/**
 * Sets up GSAP ScrollTrigger animations
 */
function initScrollAnimations() {
    if (typeof gsap === 'undefined') {
        console.warn("GSAP/ScrollTrigger not loaded. Skipping scroll animations.");
        return;
    }
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "main", 
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
        }
    });

    tl.to(camera.position, {
        z: 15, y: -2,
        scrollTrigger: { trigger: "#problem", start: "top bottom", end: "bottom top", scrub: 1 }
    }, 0); 
    tl.to(particleGroup.rotation, {
        x: 1, z: 0.5,
        scrollTrigger: { trigger: "#problem", start: "top top", end: "bottom top", scrub: 1 }
    }, 0);
    tl.to(camera.position, {
        z: 8,  x: 3,  y: 0,
        scrollTrigger: { trigger: "#solution", start: "top bottom", end: "bottom top", scrub: 1 }
    }, 1);
    tl.to(particleGroup.rotation, {
        x: -0.5, y: 1, z: 1,
        scrollTrigger: { trigger: "#solution", start: "top top", end: "bottom top", scrub: 1 }
    }, 1);
}


// ================================================================
// 5. STANDARD UI HELPER FUNCTIONS
// ================================================================

/**
 * Adds a 'scrolled' class to the header
 */
function handleHeaderScroll() {
    const header = document.getElementById('header');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
}

/**
 * Sets up smooth scrolling for all anchor links
 */
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const linkPath = new URL(this.href, window.location.origin).pathname;
            const currentPath = window.location.pathname;
            if (linkPath === currentPath && this.hash !== "") {
                e.preventDefault();
                const targetElement = document.querySelector(this.hash);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

/**
 * Initializes the side-nav scroll spy logic
 */
function setupScrollSpy() {
    const sideNav = document.querySelector('.side-nav');
    if (!sideNav) return;
    
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
    sections.sort((a, b) => a.offsetTop - b.offsetTop);
}

/**
* Updates the active link in the side-nav based on scroll position
*/
function handleSideNavActiveState() {
    if (sections.length === 0) return;
    
    let currentSection = sections[0];
    const headerOffset = 100; 

    for (const section of sections) {
        const sectionTop = section.offsetTop;
        if (window.scrollY >= sectionTop - headerOffset) {
            currentSection = section;
        }
    }
    
    navLinks.forEach((link, section) => {
        if (section === currentSection) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}
