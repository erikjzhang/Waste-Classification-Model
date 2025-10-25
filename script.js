/*
  ================================================================
  Project Sort(Ed) - Main Script
  
  This script is now CLEAN of secret keys.
  It imports the config from the untracked 'firebase-config.js' file.
  ================================================================
*/

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration (IMPORTED) ---
// The config is now safely imported from a separate, un-tracked file
import { firebaseConfig } from './firebase-config.js';


// --- Firebase App Variables ---
let app, auth, db, analytics;
let userId = null;
let dbCollection = null; 

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
// FIREBASE & AUTHENTICATION
// ================================================================

/**
 * Initializes Firebase, handles authentication, and sets up auth listener.
 */
async function initializeFirebase() {
    // This will no longer fail, as firebaseConfig is imported
    if (firebaseConfig && firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        analytics = getAnalytics(app);
        db = getFirestore(app);
        auth = getAuth(app);

        // setLogLevel('debug'); // Uncomment for Firebase debugging

        try {
            // Sign in anonymously for local testing
            await signInAnonymously(auth);

        } catch (error) {
            console.error("Firebase Auth Error:", error);
        }
    
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("User authenticated (anonymously):", userId);
                
                // UPDATED: Use a simple root collection path
                const collectionPath = "classifications";
                dbCollection = collection(db, collectionPath);
                console.log("Listening to collection:", collectionPath);
                
                // NOW set up the listener
                if (percentageChart && weightChart) {
                    setupFirebaseListener();
                }
            } else {
                userId = null;
                console.log("User is signed out.");
            }
        });

    } else {
        // This error should not appear anymore
        console.error("Firebase config is missing or incomplete.");
        document.body.innerHTML = `<div style="color: red; text-align: center; margin-top: 50px; font-family: 'Space Grotesk', sans-serif; font-size: 1.2rem;">Error: Firebase configuration is missing. The dashboard cannot load.</div>`;
    }
}

/**
 * Sets up the onSnapshot listener to get live data from Firestore
 * and update the dashboard. (UPDATED FOR 4 CATEGORIES)
 */
function setupFirebaseListener() {
    if (!dbCollection) {
        console.warn("dbCollection not ready, skipping listener setup.");
        return;
    }
    
    console.log("Setting up Firebase listener...");
    
    onSnapshot(dbCollection, (querySnapshot) => {
        console.log("Received data from Firebase:", querySnapshot.size, "items");
        
        let totalWeight = 0, plasticWeight = 0, metalWeight = 0, organicWeight = 0, glassWeight = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.weight_kg) {
                totalWeight += data.weight_kg;
                // Match these to your Teachable Machine class names
                switch (data.type) {
                    case 'Plastic': plasticWeight += data.weight_kg; break;
                    case 'Metal': metalWeight += data.weight_kg; break;
                    case 'Organic': organicWeight += data.weight_kg; break;
                    case 'Glass': glassWeight += data.weight_kg; break;
                }
            }
        });

        // Calculate derived stats
        const landfillDiversion = totalWeight; 
        // Note: CO2 calculation may need updating for 'Glass'
        const co2Saved = (plasticWeight * 2.5) + (metalWeight * 1.8) + (organicWeight * 0.1) + (glassWeight * 0.2); // Added estimated value for glass

        updateDashboard({
            plasticWeight, metalWeight, organicWeight, glassWeight, totalWeight,
            landfillDiversion, co2Saved
        });

    }, (error) => {
        console.error("Error listening to Firestore: ", error);
    });
}


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
        if (section === currentSecti) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

