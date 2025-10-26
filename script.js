/*
  ================================================================
  WasteWise - Main Script
 
  This script is now CLEAN of secret keys.
  It imports the config from the untracked 'firebase-config.js' file.
  ================================================================
*/

// --- Firebase SDK Imports (Ensure you use the current version) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- Configuration (Assumed to be in a separate, un-tracked file) ---
import { firebaseConfig } from './firebase-config.js'; // Requires this file to exist

// --- Global App Variables ---
let app, auth, db, analytics;
let userId = null;

// --- Collection Name (MUST match the Python script) ---
const LIVE_COLLECTION_PATH = "live_conveyor_belt_stats";

// --- Dashboard & UI Variables ---
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
    // New colors for 3D models
    silver: 0xc0c0c0,
    green: 0x52b69a,
    brown: 0x8b4513
};


/**
 * Runs when the page is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- UI Setup ---
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

    // --- Chart Initialization ---
    const percentageChartCtx = document.getElementById('wastePercentageChart');
    if (percentageChartCtx) {
        initPercentageChart(percentageChartCtx.getContext('2d'));
    }
    const weightChartCtx = document.getElementById('wasteWeightChart');
    if (weightChartCtx) {
        initWeightChart(weightChartCtx.getContext('2d'));
    }
    
    // --- 3D & Animation Setup ---
    init3DScene();
    initScrollAnimations(); // This sets up GSAP

    // --- Firebase Initialization ---
    initializeFirebase();

    // --- NEW: Preloader Fade Out ---
    // This runs after all the setup functions above have been called.
    // We give it a short delay to ensure the 3D scene has a moment
    // to render its first frame, preventing a "flash" of empty space.
    gsap.to([".loader-logo", ".loader-spinner"], {
        opacity: 1,
        duration: 0.5, // Quick 0.5s fade-in
        ease: "power1.out",
        // 2. When fade-in is done, start the fade-out
        onComplete: () => {
            // "fades out even more gradually"
            gsap.to("#preloader", {
                autoAlpha: 0,    // Fades opacity and sets visibility: hidden
                duration: 2.0,   // Gradual 2-second fade (was 1.0)
                delay: 0.5,      // Wait 0.5s before starting the fade-out
                ease: "power2.inOut"
            });
        }
    });
});


// ================================================================
// 3D SCENE & ANIMATION (THEMED)
// ================================================================

/**
 * Initializes the main Three.js scene
 */
function init3DScene() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PALETTE.darkBlue, 5, 25);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true // Transparent background
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
    
    // Define representative geometries
    const canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16);
    const bottleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 16);
    const organicGeo = new THREE.SphereGeometry(0.06, 16, 16);
    
    const geometries = [canGeo, bottleGeo, organicGeo];

    // Define representative materials
    const canMat = new THREE.MeshStandardMaterial({ 
        color: PALETTE.silver, 
        metalness: 0.8, 
        roughness: 0.3 
    });
    const bottleMat = new THREE.MeshStandardMaterial({ 
        color: PALETTE.green, 
        roughness: 0.1, 
        transparent: true, 
        opacity: 0.8 
    });
    const organicMat = new THREE.MeshStandardMaterial({ 
        color: PALETTE.brown, 
        roughness: 0.8 
    });

    const materials = [canMat, bottleMat, organicMat];

    // Create and position randomly
    for (let i = 0; i < particleCount; i++) {
        // Pick a random type
        const typeIndex = Math.floor(Math.random() * 3);
        const geo = geometries[typeIndex];
        const mat = materials[typeIndex];
        
        const mesh = new THREE.Mesh(geo, mat);

        // Position randomly in a large cube
        mesh.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );

        // Random rotation
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

    // Subtle continuous rotation
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
    // Register the plugin
    gsap.registerPlugin(ScrollTrigger);

    // Create a timeline linked to the scrollbar
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "main", // Animate based on the main content
            start: "top top",
            end: "bottom bottom",
            scrub: 1, // Smoothly scrub animation as user scrolls
        }
    });

    // --- Define the animations ---
    
    // 1. Start: Camera is at z=5
    
    // 2. As we scroll to the "Problem" section
    tl.to(camera.position, {
        z: 15, // Move camera further back
        y: -2, // Move camera down
        scrollTrigger: {
            trigger: "#problem",
            start: "top bottom",
            end: "bottom top",
            scrub: 1
        }
    }, 0); 

    // 3. As we scroll through the "Problem" section
    tl.to(particleGroup.rotation, {
        x: 1, // Rotate the particle group
        z: 0.5,
        scrollTrigger: {
            trigger: "#problem",
            start: "top top",
            end: "bottom top",
            scrub: 1
        }
    }, 0);

    // 4. As we scroll to the "Solution" section
    tl.to(camera.position, {
        z: 8,  // Move camera closer
        x: 3,  // Move camera to the right
        y: 0,
        scrollTrigger: {
            trigger: "#solution",
            start: "top bottom",
            end: "bottom top",
            scrub: 1
        }
    }, 1); // Add at 1 second into the timeline (relative)
    
    // 5. As we scroll through "Solution"
    tl.to(particleGroup.rotation, {
        x: -0.5,
        y: 1,
        z: 1,
        scrollTrigger: {
            trigger: "#solution",
            start: "top top",
            end: "bottom top",
            scrub: 1
        }
    }, 1);
}


// ================================================================
// CORE FIREBASE SETUP AND AUTHENTICATION (Your Provided Logic)
// ================================================================

/**
 * Initializes Firebase, handles authentication, and sets up auth listener.
 */
async function initializeFirebase() {
    if (firebaseConfig && firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app); 
        // analytics = getAnalytics(app); // Uncomment if needed

        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Firebase Auth Error:", error);
        }
    
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("User authenticated (anonymously). Starting listener...");
                
                // Start the core data listener only after authentication
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

// ================================================================
// LIVE DATA LISTENER (ADAPTED FOR AGGREGATED PYTHON DATA)
// ================================================================

/**
 * Sets up the onSnapshot listener to get the SINGLE LATEST aggregated document
 * pushed from the Colab/Python backend.
 */
function setupFirebaseListener() {
    const collectionRef = collection(db, LIVE_COLLECTION_PATH); 

    // We query the collection, order by the latest timestamp, and grab only the newest document.
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
            // The document contains the fully pre-calculated summary from Colab
            const liveAggregatedData = doc.data(); 

            // --- ⚠️ CRUCIAL DEBUGGING STEP ---
            console.log("✅ LIVE AGGREGATED DATA RECEIVED:", liveAggregatedData);
            
            // Pass the aggregated data structure directly to the dashboard updater
            updateDashboard(liveAggregatedData); 
        });

    }, (error) => {
        console.error("Error listening to Firestore: ", error);
    });
}


// ================================================================
// DASHBOARD UPDATE FUNCTION
// ================================================================

/**
 * Updates all charts and metrics using the aggregated JSON structure 
 * pushed by the Python script.
 */
function updateDashboard(data) {
    // 1. EXTRACT DATA DIRECTLY FROM THE AGGREGATED DOCUMENT
    const massDistribution = data.mass_distribution_kg; // {plastic: 10.5, metal: 5.2, ...}
    const percentComposition = data.percent_composition; // {plastic: 60.1, metal: 30.9, ...}
    const environmentalImpact = data.environmental_impact; 

    const totalWeight = data.total_mass_kg;
    const co2Saved = environmentalImpact.total_co2_avoided_kg;

    console.log(`Updating dashboard. Total Weight: ${totalWeight.toFixed(2)} kg`);

    // 2. UPDATE CORE METRICS (Example)
    const totalMassElement = document.getElementById('total-mass-metric');
    if (totalMassElement) {
        totalMassElement.innerText = totalWeight.toFixed(2);
    }

    const co2SavedElement = document.getElementById('co2-saved-metric');
    if (co2SavedElement) {
        co2SavedElement.innerText = co2Saved.toFixed(2);
    }
    
    // 3. UPDATE CHART DATA (You would integrate Chart.js here)
    const chartLabels = Object.keys(percentComposition);
    const chartData = Object.values(percentComposition);
    
    // Example: If you have a Chart.js object named 'myPieChart'
    // if (myPieChart) {
    //     myPieChart.data.labels = chartLabels;
    //     myPieChart.data.datasets[0].data = chartData;
    //     myPieChart.update();
    // }
    
    // You would loop through massDistribution to update individual weight metrics.
}

// 4. START THE APPLICATION
initializeFirebase();

// ================================================================
// DASHBOARD & UI HELPERS
// ================================================================

/**
 * Initializes the Doughnut chart (DARK MODE, 4 CATEGORIES)
 */
function initPercentageChart(ctx) {
    if (!ctx) return;
    percentageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Plastic', 'Metal', 'Organic', 'Glass'], // UPDATED
            datasets: [{
                label: 'Waste Composition',
                data: [0, 0, 0, 0], // UPDATED
                backgroundColor: [
                    PALETTE.accentCyan, 
                    PALETTE.accentTeal, 
                    PALETTE.brown, 
                    PALETTE.textDark
                ], // UPDATED
                borderColor: PALETTE.darkBlue,
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
                        font: { family: 'Space Grotesk', size: 14 }
                    }
                }
            }
        }
    });
}

/**
 * Initializes the Bar chart (DARK MODE, 4 CATEGORIES)
 */
function initWeightChart(ctx) {
    if (!ctx) return;
    weightChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Plastic', 'Metal', 'Organic', 'Glass'], // UPDATED
            datasets: [{
                label: 'Weight (kg)',
                data: [0, 0, 0, 0], // UPDATED
                backgroundColor: [
                    PALETTE.accentCyan, 
                    PALETTE.accentTeal, 
                    PALETTE.brown, 
                    PALETTE.textDark
                ], // UPDATED
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#ccd6f6', font: { family: 'Space Grotesk' } },
                    grid: { color: 'rgba(204, 214, 246, 0.1)' }
                },
                x: {
                    ticks: { color: '#ccd6f6', font: { family: 'Space Grotesk', size: 14 } },
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
 * Updates all charts and stats cards with new data. (UPDATED FOR 4 CATEGORIES)
 */
function updateDashboard(data) {
    const totalForPercent = data.totalWeight > 0 ? data.totalWeight : 1;
    
    const plasticPercent = (data.plasticWeight / totalForPercent) * 100;
    const metalPercent = (data.metalWeight / totalForPercent) * 100;
    const organicPercent = (data.organicWeight / totalForPercent) * 100;
    const glassPercent = (data.glassWeight / totalForPercent) * 100; // UPDATED

    document.getElementById('totalWeight').innerText = data.totalWeight.toFixed(2) + ' kg';
    document.getElementById('landfillDiversion').innerText = data.landfillDiversion.toFixed(2) + ' kg';
    document.getElementById('co2Saved').innerText = data.co2Saved.toFixed(2) + ' kg';

    if (percentageChart) {
        percentageChart.data.datasets[0].data = [plasticPercent, metalPercent, organicPercent, glassPercent]; // UPDATED
        percentageChart.update();
    }
    if (weightChart) {
        weightChart.data.datasets[0].data = [data.plasticWeight, data.metalWeight, data.organicWeight, data.glassWeight]; // UPDATED
        weightChart.update();
    }
}

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
            const currentPath = window.location.origin + window.location.pathname;
            
            // Check if the link's path is the same as the current page's path
            // This prevents smooth-scroll from breaking links to other pages (like About Us)
            // that don't start with a hash.
            if (linkPath === window.location.pathname && this.hash !== "") {
                e.preventDefault();
                const targetElement = document.querySelector(this.hash);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
            // If linkPath is different (e.g., "About_Webpage/aboutPage.html")
            // or if there's no hash, the default link behavior will proceed.
        });
    });
}


/**
 * Initializes the side-nav scroll spy logic
 */
function setupScrollSpy() {
    const sideNav = document.querySelector('.side-nav');
    if (!sideNav) return;
    
    // Clear previous state
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
    // Sort sections by their top position
    sections.sort((a, b) => a.offsetTop - b.offsetTop);
}

/**
* Updates the active link in the side-nav based on scroll position
*/
function handleSideNavActiveState() {
    if (sections.length === 0) return;
    
    let currentSection = sections[0]; // Default to first section
    const headerOffset = 100; // A bit of buffer

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
