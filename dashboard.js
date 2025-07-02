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
    const excludedStatuses = ['Done', 'Done (Other)', 'Missing Photo'];
    
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
