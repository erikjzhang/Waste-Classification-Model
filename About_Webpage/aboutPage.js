// This runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // --- HEADER LOGIC ---
    // On the about page, make the header solid from the start
    const header = document.getElementById('header');
    if (header) {
        header.classList.add('scrolled');
    }

    // --- SMOOTH SCROLL LOGIC ---
    // This is only for on-page links. Since about.html has no on-page
    // hash links, this isn't strictly necessary, but it's good practice
    // if you were to add a "back to top" link, for example.
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
});
