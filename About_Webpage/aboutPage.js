// This runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // --- HEADER LOGIC ---
    // On the about page, make the header solid from the start
    const header = document.getElementById('header');
    if (header) {
        header.classList.add('scrolled');
    }

    // --- SMOOTH SCROLL LOGIC ---
    // Sets up smooth scrolling for any on-page anchor links.
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // Get the full URL path of the link and the current page
            const linkPath = new URL(this.href, window.location.origin).pathname;
            const currentPath = window.location.pathname;

            // Only smooth scroll if the link is on the *current* page.
            if (linkPath === currentPath && this.hash) {
                e.preventDefault(); // Stop the default browser jump
                
                // Find the target and scroll to it smoothly.
                document.querySelector(this.hash)?.scrollIntoView({
                    behavior: 'smooth'
                });
            }
            // If the link goes to another page (e.g., index.html#dashboard from about.html),
            // the browser will handle the navigation normally.
        });
    });
});
