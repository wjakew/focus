document.addEventListener('DOMContentLoaded', () => {
    // Get window control buttons
    const minimizeButton = document.getElementById('minimize-button');
    const maximizeButton = document.getElementById('maximize-button');
    const closeButton = document.getElementById('close-button');

    // Add click event listeners
    minimizeButton.addEventListener('click', () => {
        window.api.minimizeWindow();
    });

    maximizeButton.addEventListener('click', () => {
        window.api.maximizeWindow();
    });

    closeButton.addEventListener('click', () => {
        window.api.closeWindow();
    });

    // Update maximize button icon based on window state
    window.api.onWindowMaximized(() => {
        maximizeButton.querySelector('svg').innerHTML = `
            <path d="M3.5 3.5v5h5v-5h-5zM2 2h8v8H2V2zm4.5-1.5v5h5v-5h-5zM10 0h2v2h-2V0zM0 10h2v2H0v-2z" fill="currentColor"/>
        `;
    });

    window.api.onWindowUnmaximized(() => {
        maximizeButton.querySelector('svg').innerHTML = `
            <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"/>
        `;
    });
}); 