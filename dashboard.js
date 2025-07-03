// Break-even points
const BEP = {
    daily: 2917,
    weekly: 14585,
    monthly: 62706
};

// Update time and date
function updateDateTime() {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    
    document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', timeOptions);
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Calculate difference from BEP
function calculateDifference(actual, bep) {
    const diff = actual - bep;
    const formatted = formatCurrency(Math.abs(diff));
    return {
        value: formatted,
        isPositive: diff >= 0
    };
}

// Fetch Jobber jobs
async function fetchJobberJobs() {
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const response = await fetch('/.netlify/functions/jobber', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `
                    query {
                        visits(
                            filter: {
                                startAt: {
                                    gte: "${today.toISOString().split('T')[0]}T00:00:00Z"
                                    lte: "${tomorrow.toISOString().split('T')[0]}T23:59:59Z"
                                }
                            }
                            first: 50
                        ) {
                            nodes {
                                startAt
                                client { name }
                                property { address { street1 city } }
                            }
                        }
                    }
                `
            })
        });

        const data = await response.json();
        console.log('Jobber response:', JSON.stringify(data, null, 2)); 
        displayJobs(data.data.visits.nodes);
    } catch (error) {
        console.error('Error fetching Jobber jobs:', error);
        document.getElementById('today-jobs').innerHTML = '<div style="color: #f87171;">Error loading jobs</div>';
        document.getElementById('tomorrow-jobs').innerHTML = '<div style="color: #f87171;">Error loading jobs</div>';
    }
}

// Display jobs
function displayJobs(jobs) {
    const today = new Date().toDateString();
    const todayJobs = jobs.filter(job => new Date(job.startAt).toDateString() === today);
    const tomorrowJobs = jobs.filter(job => new Date(job.startAt).toDateString() !== today);

    const formatJob = (job) => {
        const time = new Date(job.startAt).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        return `
            <div class="job-item">
                <div class="job-time">${time}</div>
                <div class="job-customer">${job.client.name}</div>
                <div class="job-address">${job.property.address.street1}, ${job.property.address.city}</div>
            </div>
        `;
    };

    document.getElementById('today-jobs').innerHTML = todayJobs.length > 0 
        ? todayJobs.map(formatJob).join('') 
        : '<div style="color: #666;">No jobs scheduled</div>';
    
    document.getElementById('tomorrow-jobs').innerHTML = tomorrowJobs.length > 0 
        ? tomorrowJobs.map(formatJob).join('') 
        : '<div style="color: #666;">No jobs scheduled</div>';
}

// Fetch Jobber revenue
async function fetchJobberRevenue() {
    try {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0,0,0,0));
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);

        const response = await fetch('/.netlify/functions/jobber', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `
                    query {
                        invoices(
                            filter: {
                                createdAt: { gte: "${startOfLastYear.toISOString()}" }
                                status: { in: [PAID, PARTIALLY_PAID] }
                            }
                            first: 1000
                        ) {
                            nodes {
                                total { raw }
                                createdAt
                            }
                        }
                    }
                `
            })
        });

        const data = await response.json();
        console.log('Jobber revenue response:', JSON.stringify(data, null, 2));
        calculateAndDisplayRevenue(data.data.invoices.nodes);
    } catch (error) {
        console.error('Error fetching revenue:', error);
    }
}

// Calculate and display revenue
function calculateAndDisplayRevenue(invoices) {
    const now = new Date();
    const today = new Date(now.setHours(0,0,0,0));
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    
    let dailyRevenue = 0;
    let weeklyRevenue = 0;
    let monthlyRevenue = 0;
    let ytdCurrent = 0;
    let ytdPrevious = 0;

    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.createdAt);
        const amount = parseFloat(invoice.total.raw);

        if (invoiceDate >= today) dailyRevenue += amount;
        if (invoiceDate >= weekStart) weeklyRevenue += amount;
        if (invoiceDate >= monthStart) monthlyRevenue += amount;
        
        if (invoiceDate >= yearStart) {
            ytdCurrent += amount;
        } else if (invoiceDate >= lastYearStart && invoiceDate.getMonth() <= now.getMonth() && 
                   (invoiceDate.getMonth() < now.getMonth() || invoiceDate.getDate() <= now.getDate())) {
            ytdPrevious += amount;
        }
    });

    // Update daily revenue
    document.getElementById('daily-revenue').textContent = formatCurrency(dailyRevenue);
    const dailyDiff = calculateDifference(dailyRevenue, BEP.daily);
    document.getElementById('daily-diff').textContent = dailyDiff.value;
    document.getElementById('daily-diff').className = dailyDiff.isPositive ? 'positive' : 'negative';

    // Update weekly revenue
    document.getElementById('weekly-revenue').textContent = formatCurrency(weeklyRevenue);
    const weeklyDiff = calculateDifference(weeklyRevenue, BEP.weekly);
    document.getElementById('weekly-diff').textContent = weeklyDiff.value;
    document.getElementById('weekly-diff').className = weeklyDiff.isPositive ? 'positive' : 'negative';

    // Update monthly revenue
    document.getElementById('monthly-revenue').textContent = formatCurrency(monthlyRevenue);
    const monthlyDiff = calculateDifference(monthlyRevenue, BEP.monthly);
    document.getElementById('monthly-diff').textContent = monthlyDiff.value;
    document.getElementById('monthly-diff').className = monthlyDiff.isPositive ? 'positive' : 'negative';

    // Update YTD
    document.getElementById('ytd-previous').textContent = formatCurrency(ytdPrevious);
    document.getElementById('ytd-current').textContent = formatCurrency(ytdCurrent);
}

// Fetch OpenPhone stats
async function fetchOpenPhoneStats() {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
        
        const response = await fetch('/.netlify/functions/openphone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ startTime: startOfDay })
        });

        const data = await response.json();
        console.log('OpenPhone response:', JSON.stringify(data, null, 2));
        const totalCalls = data.data.length;
        const missedCalls = data.data.filter(call => call.status === 'missed').length;
        
        document.getElementById('call-volume').textContent = totalCalls;
        document.getElementById('missed-calls').textContent = missedCalls;
    } catch (error) {
        console.error('Error fetching OpenPhone stats:', error);
        document.getElementById('call-volume').textContent = '—';
        document.getElementById('missed-calls').textContent = '—';
    }
}

// Fetch Monday.com order status
async function fetchMondayOrderStatus() {
    try {
        const response = await fetch('/.netlify/functions/monday', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `
                    query {
                        boards(ids: 5991290736) {
                            id
                            name
                            items_page(limit: 500) {
                                items {
                                    id
                                    name
                                    column_values {
                                        id
                                        text
                                        value
                                }
                            }
                        }
                    }
                  }  
                `
            })
        });

        const data = await response.json();
console.log('Monday boards:', JSON.stringify(data.data.boards.map(b => ({name: b.name, id: b.id, columns: b.columns})), null, 2));
        displayOrderStatusChart(data.data.boards[0].items_page.items);
    } catch (error) {
        console.error('Error fetching Monday.com data:', error);
    }
}

// Display order status pie chart
function displayOrderStatusChart(items) {
    const statusCounts = {};
    
    // Debug: Show first 5 items
    console.log('First 5 items:', items.slice(0, 5).map(item => ({
        name: item.name,
        status: item.column_values.find(col => col.id === 'status')
    })));
    
    // Statuses to exclude from the chart
const excludedStatuses = ['Done', 'Done (Other)', 'Missing Photo', 'Default', 'DONE', 'DONE (OTHER)', 'DAMAGED', 'MISSING PHOTO'];
    
    items.forEach(item => {
        // Find the status column value
        const statusColumn = item.column_values.find(col => col.id === 'status');
        const status = statusColumn?.text || 'Unknown';
        
        // Only count non-empty statuses that aren't in the excluded list
        if (status && status !== '' && !excludedStatuses.includes(status)) {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
    });

    console.log('Status counts:', statusCounts);

    // If no statuses found, show a message
    if (Object.keys(statusCounts).length === 0) {
        statusCounts['No Status Set'] = 1;
    }

    const ctx = document.getElementById('orderStatusChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: Object.keys(statusCounts).map(status => {
                    // Match Monday.com colors
                    const colorMap = {
                        'RETURN VISIT REQUIRED': '#ff6b6b',  // Red/Orange
                        'SCHEDULED FOR INSTALL': '#51cf66',  // Green
                        'IN THE SHOP': '#94d0cc',           // Light teal/green
                        'ORDERED': '#aa78d6',               // Purple
                        'Yes (has been, no email)': '#aa78d6', // Purple
                        // Add more status-color mappings as needed
                    };
                    return colorMap[status] || '#666666'; // Default gray for unmapped statuses
                }),
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 14
                        }
                    }
                }
            }
        }
    });
}
// Fetch AirIQ Fleet vehicle locations
// Fetch AirIQ Fleet vehicle locations
async function fetchAirIQVehicles() {
    try {
        // First, get the list of companies
        const companiesResponse = await fetch('/.netlify/functions/airiq', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endpoint: '/v2/companies' })
        });

        const companiesData = await companiesResponse.json();
        console.log('AirIQ Companies:', companiesData);

        if (companiesData && companiesData.length > 0) {
            // Get fleets for the first company
            const companyId = companiesData[0].id;
            const fleetsResponse = await fetch('/.netlify/functions/airiq', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ endpoint: `/v2/companies/${companyId}/fleets` })
            });

            const fleetsData = await fleetsResponse.json();
            console.log('Fleets response status:', fleetsResponse.status);  // NEW LINE
            console.log('AirIQ Fleets:', fleetsData);

            if (fleetsData && fleetsData.length > 0) {
                // Get assets status for the first fleet
                const fleetId = fleetsData[0].id;
                const assetsResponse = await fetch('/.netlify/functions/airiq', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ endpoint: `/v2/fleets/${fleetId}/assets/status` })
                });

                const assetsData = await assetsResponse.json();
                displayVehicleLocations(assetsData);
            } else {
                // NEW SECTION - If no fleets found, try getting all assets directly
                console.log('No fleets found, trying direct asset approach...');
                
                // Try AEMP endpoint which returns all assets
                const aempResponse = await fetch('/.netlify/functions/airiq', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ endpoint: '/aemp' })
                });
                
                const aempData = await aempResponse.json();
                console.log('AEMP data:', aempData);
                
                if (aempData) {
                    // Convert AEMP format to our display format
                    displayVehicleLocations(aempData);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching AirIQ data:', error);
        document.getElementById('vehicle-map').innerHTML = '<div style="color: #f87171;">Error loading vehicle data</div>';
    }
}

// Display vehicle locations
// Display vehicle locations on map
let vehicleMap = null;
function displayVehicleLocations(vehicles) {
    const mapDiv = document.getElementById('vehicle-map');
    
    if (!vehicles || vehicles.length === 0) {
        mapDiv.innerHTML = '<div style="color: #666;">No vehicles found</div>';
        return;
    }
    
    // Clear any existing map
    mapDiv.innerHTML = '';
    
    // Create container for map and legend
    mapDiv.innerHTML = `
        <div style="display: flex; height: 100%; gap: 10px;">
            <div id="actual-map" style="flex: 1; height: 100%; border-radius: 10px;"></div>
            <div id="map-legend" style="width: 200px; background: rgba(40, 40, 40, 0.8); border-radius: 10px; padding: 15px; overflow-y: auto;">
                <div style="color: #ff661a; font-weight: bold; margin-bottom: 10px;">Vehicle Legend</div>
            </div>
        </div>
    `;
    // Wait for DOM to update
setTimeout(() => {
    // Create map
    vehicleMap = L.map('actual-map').setView([43.7, -79.4], 10);
    
    // ... rest of the function code ...
    
}, 100);
    // Create map
    vehicleMap = L.map('actual-map').setView([43.7, -79.4], 10);
    
    // Add map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(vehicleMap);
    
    // Define colors for vehicles
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'darkred', 'lightred', 
                   'darkblue', 'darkgreen', 'cadetblue', 'darkpurple', 'pink', 'lightblue', 'lightgreen'];
    
    // Track bounds for all vehicles
    const bounds = [];
    let vehiclesWithLocation = 0;
    const legendDiv = document.getElementById('map-legend');
    
    // Add markers for each vehicle
    vehicles.forEach((vehicle, index) => {
        const status = vehicle.status || vehicle;
        const lat = status.latitude || status.lat;
        const lng = status.longitude || status.lng || status.lon;
        const name = vehicle.name || status.name || `Vehicle ${index + 1}`;
        const color = colors[index % colors.length];
        
        if (lat && lng) {
            vehiclesWithLocation++;
            
            // Create colored marker icon
            const markerIcon = new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(vehicleMap);
            
            // Create popup content
            let popupContent = `<strong>${name}</strong><br/>`;
            if (status.speed !== undefined) {
                popupContent += `Speed: ${status.speed} km/h<br/>`;
            }
            if (status.heading !== undefined) {
                popupContent += `Heading: ${status.heading}°<br/>`;
            }
            if (status.odometer !== undefined) {
                popupContent += `Odometer: ${status.odometer} km<br/>`;
            }
            
            marker.bindPopup(popupContent);
            bounds.push([lat, lng]);
            
            // Add to legend
            legendDiv.innerHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <div style="width: 20px; height: 20px; background-color: ${color}; border-radius: 50%; margin-right: 10px;"></div>
                    <div style="color: #ccc; font-size: 14px;">${name}</div>
                </div>
            `;
        }
    });
    
    // Fit map to show all vehicles
    if (bounds.length > 0) {
        vehicleMap.fitBounds(bounds, { padding: [50, 50] });
    }
}
// Save and load notes
function setupNotes() {
    const notesArea = document.getElementById('notes-area');
    
    // Load saved notes
    const savedNotes = localStorage.getItem('dashboard-notes');
    if (savedNotes) {
        notesArea.value = savedNotes;
    }
    
    // Save notes on change
    notesArea.addEventListener('input', () => {
        localStorage.setItem('dashboard-notes', notesArea.value);
    });
}
// Refresh all data
function refreshAllData() {
    fetchJobberJobs();
    fetchJobberRevenue();
    fetchOpenPhoneStats();
    fetchMondayOrderStatus();
    fetchAirIQVehicles();

}

// Initialize dashboard
function init() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    setupNotes();
    
    // Initial data fetch
    refreshAllData();
    
    // Refresh data every 5 minutes
    setInterval(refreshAllData, 5 * 60 * 1000);
}

// Start the dashboard when page loads
document.addEventListener('DOMContentLoaded', init);
