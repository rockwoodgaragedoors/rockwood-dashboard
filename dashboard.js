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
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Service Calls', 'Installations'],
            datasets: [{
                data: [data.service, data.installation],
                backgroundColor: ['#ff6b35', '#4ecdc4'],
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
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
    
    new Chart(ctx, {
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
                pointRadius: 3,
                pointBackgroundColor: '#ff6b35'
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
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#333',
                        borderColor: '#444'
                    },
                    ticks: {
                        color: '#999',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: '#333',
                        borderColor: '#444'
                    },
                    ticks: {
                        color: '#999',
                        callback: function(value) {
                            return '$' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            }
        }
    });
}
