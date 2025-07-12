// Jobber API wrapper with auto-refresh handling
async function callJobberAPI(query, variables = {}) {
    try {
        const response = await fetch('/.netlify/functions/jobber', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });
        
        const data = await response.json();
        
        // Check if token was refreshed
        if (data._tokenRefreshed) {
            console.warn('🔄 Jobber token was refreshed!');
            console.warn('NEW TOKEN:', data._newToken);
            console.warn('ACTION REQUIRED: Update JOBBER_API_KEY in Netlify with the new token above');
            
            // Show alert to user
            const alertDiv = document.createElement('div');
            alertDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff6b35;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                font-size: 14px;
                max-width: 400px;
            `;
            alertDiv.innerHTML = `
                <strong>⚠️ Jobber Token Refreshed</strong><br>
                <small>The token has been automatically refreshed. Check console for new token.</small>
            `;
            document.body.appendChild(alertDiv);
            
            // Remove alert after 10 seconds
            setTimeout(() => alertDiv.remove(), 10000);
            
            // Clean up the response
            delete data._tokenRefreshed;
            delete data._newToken;
        }
        
        return data;
    } catch (error) {
        console.error('Jobber API call failed:', error);
        throw error;
    }
}

// Fetch today's completed jobs and their value
async function fetchTodaysCompletedJobs() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const query = `
            query {
                visits(
                    filter: {
                        completedAt: {
                            after: "${today.toISOString()}"
                            before: "${tomorrow.toISOString()}"
                        }
                    }
                    first: 100
                ) {
                    nodes {
                        id
                        title
                        total
                        completedAt
                        lineItems {
                            nodes {
                                name
                                qty
                                unitPrice
                                total
                            }
                        }
                    }
                }
            }
        `;
        
        const data = await callJobberAPI(query);
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
            return { totalValue: 0, jobCount: 0 };
        }
        
        const visits = data.data.visits.nodes;
        const totalValue = visits.reduce((sum, visit) => sum + (visit.total || 0), 0);
        
        return {
            totalValue,
            jobCount: visits.length,
            visits
        };
    } catch (error) {
        console.error('Error fetching completed jobs:', error);
        return { totalValue: 0, jobCount: 0 };
    }
}

// Fetch service vs installation breakdown
async function fetchServiceVsInstallation() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const query = `
            query {
                visits(
                    filter: {
                        completedAt: {
                            after: "${thirtyDaysAgo.toISOString()}"
                        }
                    }
                    first: 500
                ) {
                    nodes {
                        id
                        title
                        lineItems {
                            nodes {
                                name
                                total
                            }
                        }
                    }
                }
            }
        `;
        
        const data = await callJobberAPI(query);
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
            return { service: 0, installation: 0 };
        }
        
        let serviceCount = 0;
        let installCount = 0;
        
        // Categorize jobs based on title or line items
        data.data.visits.nodes.forEach(visit => {
            const title = (visit.title || '').toLowerCase();
            const lineItems = visit.lineItems.nodes || [];
            
            // Check title and line items for keywords
            const isInstall = 
                title.includes('install') || 
                title.includes('installation') ||
                lineItems.some(item => 
                    item.name.toLowerCase().includes('install') ||
                    item.name.toLowerCase().includes('installation')
                );
            
            if (isInstall) {
                installCount++;
            } else {
                serviceCount++;
            }
        });
        
        return {
            service: serviceCount,
            installation: installCount,
            total: serviceCount + installCount
        };
    } catch (error) {
        console.error('Error fetching service vs installation:', error);
        return { service: 0, installation: 0, total: 0 };
    }
}

// Fetch revenue summary (day, week, month)
async function fetchRevenueSummary() {
    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const query = `
            query {
                invoices(
                    filter: {
                        createdAt: {
                            after: "${monthStart.toISOString()}"
                        }
                        status: paid
                    }
                    first: 1000
                ) {
                    nodes {
                        total
                        createdAt
                    }
                }
            }
        `;
        
        const data = await callJobberAPI(query);
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
            return { daily: 0, weekly: 0, monthly: 0 };
        }
        
        let dailyRevenue = 0;
        let weeklyRevenue = 0;
        let monthlyRevenue = 0;
        
        data.data.invoices.nodes.forEach(invoice => {
            const invoiceDate = new Date(invoice.createdAt);
            const amount = parseFloat(invoice.total);
            
            if (invoiceDate >= today) dailyRevenue += amount;
            if (invoiceDate >= weekStart) weeklyRevenue += amount;
            monthlyRevenue += amount; // All are from this month
        });
        
        return {
            daily: dailyRevenue,
            weekly: weeklyRevenue,
            monthly: monthlyRevenue
        };
    } catch (error) {
        console.error('Error fetching revenue summary:', error);
        return { daily: 0, weekly: 0, monthly: 0 };
    }
}

// Fetch revenue trend (last 30 days)
async function fetchRevenueTrend() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const query = `
            query {
                invoices(
                    filter: {
                        createdAt: {
                            after: "${thirtyDaysAgo.toISOString()}"
                        }
                        status: paid
                    }
                    first: 1000
                ) {
                    nodes {
                        total
                        createdAt
                    }
                }
            }
        `;
        
        const data = await callJobberAPI(query);
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
            return [];
        }
        
        // Group by date
        const revenueByDate = {};
        
        // Initialize all dates with 0
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            revenueByDate[dateStr] = 0;
        }
        
        // Sum revenue by date
        data.data.invoices.nodes.forEach(invoice => {
            const dateStr = invoice.createdAt.split('T')[0];
            if (revenueByDate.hasOwnProperty(dateStr)) {
                revenueByDate[dateStr] += parseFloat(invoice.total);
            }
        });
        
        // Convert to array for chart
        const trend = Object.entries(revenueByDate)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, revenue]) => ({
                date,
                revenue,
                label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));
        
        return trend;
    } catch (error) {
        console.error('Error fetching revenue trend:', error);
        return [];
    }
}

// Main function to fetch all Jobber stats
async function fetchAllJobberStats() {
    console.log('Fetching all Jobber stats...');
    
    // Fetch all data in parallel for better performance
    const [completedJobs, serviceVsInstall, revenueSummary, revenueTrend] = await Promise.all([
        fetchTodaysCompletedJobs(),
        fetchServiceVsInstallation(),
        fetchRevenueSummary(),
        fetchRevenueTrend()
    ]);
    
    // Update the dashboard
    updateJobberDashboard({
        completedJobs,
        serviceVsInstall,
        revenueSummary,
        revenueTrend
    });
}

// Update dashboard with new stats
function updateJobberDashboard(stats) {
    // Update completed jobs value
    document.getElementById('completed-jobs-value').textContent = formatCurrency(stats.completedJobs.totalValue);
    document.getElementById('completed-jobs-count').textContent = `${stats.completedJobs.jobCount} jobs completed today`;
    
    // Update revenue summary
    document.getElementById('daily-revenue').textContent = formatCurrency(stats.revenueSummary.daily);
    document.getElementById('weekly-revenue').textContent = formatCurrency(stats.revenueSummary.weekly);
    document.getElementById('monthly-revenue').textContent = formatCurrency(stats.revenueSummary.monthly);
    
    // Create service vs installation pie chart
    createServiceVsInstallChart(stats.serviceVsInstall);
    
    // Create revenue trend line chart
    createRevenueTrendChart(stats.revenueTrend);
}

// Create service vs installation pie chart
function createServiceVsInstallChart(data) {
    const ctx = document.getElementById('serviceVsInstallChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.serviceVsInstallChartInstance) {
        window.serviceVsInstallChartInstance.destroy();
    }
    
    window.serviceVsInstallChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Service Calls', 'Installations'],
            datasets: [{
                data: [data.service, data.installation],
                backgroundColor: ['#ff6b35', '#4ecdc4'],
                borderColor: 'rgba(0, 0, 0, 0.2)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.total;
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Create revenue trend line chart
function createRevenueTrendChart(trend) {
    const ctx = document.getElementById('revenueTrendChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.revenueTrendChartInstance) {
        window.revenueTrendChartInstance.destroy();
    }
    
    window.revenueTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trend.map(d => d.label),
            datasets: [{
                label: 'Daily Revenue',
                data: trend.map(d => d.revenue),
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                tension: 0.3,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: '#ff6b35'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            }
        }
    });
}

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
        
        console.log('Calling Jobber API...');
        
        const query = `
            query {
                visits(
                    filter: {
                        startAt: {
                            after: "${today.toISOString().split('T')[0]}T00:00:00Z"
                            before: "${tomorrow.toISOString().split('T')[0]}T23:59:59Z"
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
        `;
        
        const data = await callJobberAPI(query);
        
        console.log('Jobber response:', JSON.stringify(data, null, 2)); 
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
        }
        
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

// Fetch Jobber revenue (keeping for YTD stats)
async function fetchJobberRevenue() {
    try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);

        console.log('Calling Jobber API for YTD...');
        
        const query = `
            query {
                invoices(
                    filter: {
                        createdAt: {
                            after: "${startOfLastYear.toISOString()}"
                        }
                        status: paid
                    }
                    first: 1000
                ) {
                    nodes {
                        total
                        createdAt
                    }
                }
            }
        `;
        
        const data = await callJobberAPI(query);
        
        console.log('Jobber YTD response:', JSON.stringify(data, null, 2));
        
        if (data.errors) {
            console.error('Jobber GraphQL errors:', data.errors);
        }
        
        calculateYTDRevenue(data.data.invoices.nodes);
    } catch (error) {
        console.error('Error fetching YTD revenue:', error);
    }
}

// Calculate YTD revenue
function calculateYTDRevenue(invoices) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    
    let ytdCurrent = 0;
    let ytdPrevious = 0;

    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.createdAt);
        const amount = parseFloat(invoice.total);
        
        if (invoiceDate >= yearStart) {
            ytdCurrent += amount;
        } else if (invoiceDate >= lastYearStart && invoiceDate.getMonth() <= now.getMonth() && 
                   (invoiceDate.getMonth() < now.getMonth() || invoiceDate.getDate() <= now.getDate())) {
            ytdPrevious += amount;
        }
    });

    // Update YTD
    document.getElementById('ytd-previous').textContent = formatCurrency(ytdPrevious);
    document.getElementById('ytd-current').textContent = formatCurrency(ytdCurrent);
}

// Fetch OpenPhone stats
async function fetchOpenPhoneStats() {
    try {
        // Fetch stats from our webhook endpoint
        const response = await fetch('/.netlify/functions/openphone-webhook', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            const stats = await response.json();
            console.log('OpenPhone webhook stats:', stats);
            
            document.getElementById('call-volume').textContent = stats.totalCalls || 0;
            document.getElementById('missed-calls').textContent = stats.missedCalls || 0;
            
            // If no calls yet, show a helpful message
            if (stats.totalCalls === 0) {
                document.getElementById('call-volume').innerHTML = 
                    '<span style="font-size: 12px;" title="Webhook is set up and waiting for calls">Ready</span>';
            }
        } else {
            throw new Error('Failed to fetch webhook stats');
        }
        
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
                borderColor: 'rgba(0, 0, 0, 0.2)',
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
                            size: 12
                        },
                        padding: 15
                    }
                }
            }
        }
    });
}

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
            console.log('Fleets response status:', fleetsResponse.status);
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
                // If no fleets found, try getting all assets directly
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
        <div style="position: relative; height: 100%; width: 100%;">
            <div id="actual-map" style="position: absolute; top: 0; left: 0; right: 220px; bottom: 0; border-radius: 10px;"></div>
            <div id="map-legend" style="position: absolute; top: 0; right: 0; width: 200px; bottom: 0; background: rgba(40, 40, 40, 0.8); border-radius: 10px; padding: 15px; overflow-y: auto;">
                <div style="color: #ff661a; font-weight: bold; margin-bottom: 10px;">Vehicle Legend</div>
            </div>
        </div>
    `;
    
    // Wait for DOM to update
    setTimeout(() => {
        // Create map
        vehicleMap = L.map('actual-map').setView([43.7, -79.4], 10);
        
        // Add map tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(vehicleMap);
        
        // Define colors and names for vehicles
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'darkred', 'lightred', 
                       'darkblue', 'darkgreen', 'cadetblue', 'darkpurple', 'pink', 'lightblue', 'lightgreen'];

        // Custom vehicle names mapping
        const vehicleNames = {
            0: "Matt",
            1: "JJ's Van", 
            2: "Jay's Truck",
            3: "New Van"
        };

        // Track bounds for all vehicles
        const bounds = [];
        let vehiclesWithLocation = 0;
        const legendDiv = document.getElementById('map-legend');

        // Add markers for each vehicle
        vehicles.forEach((vehicle, index) => {
            const status = vehicle.status || vehicle;
            const lat = status.latitude || status.lat;
            const lng = status.longitude || status.lng || status.lon;
            const name = vehicleNames[index] || vehicle.name || status.name || `Vehicle ${index + 1}`;
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
    }, 100);
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
    fetchAllJobberStats();
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
