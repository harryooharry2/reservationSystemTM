// Admin Dashboard JavaScript
import { supabase } from './supabase.js';
import { authFetch } from './auth.js';

class AdminDashboard {
  constructor() {
    this.currentUser = null;
    this.currentSection = 'dashboard';
    this.reservations = [];
    this.tables = [];
    this.customers = [];
    this.realTimeSubscription = null;

    this.init();
  }

  async init() {
    await this.checkAuth();
    this.setupEventListeners();
    this.loadDashboardData();
    this.setupRealTimeUpdates();
  }

  async checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login?redirect=/admin';
      return;
    }

    this.currentUser = user;

    // Check user role
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !['admin', 'staff'].includes(userProfile.role)) {
      window.location.href = '/?error=unauthorized';
      return;
    }
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach((button) => {
      button.addEventListener('click', (e) => {
        const section = e.target.id.replace('nav-', '');
        this.showSection(section);
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Reservation filters
    document
      .getElementById('refresh-reservations')
      .addEventListener('click', () => {
        this.loadReservations();
      });

    document.getElementById('date-filter').addEventListener('change', () => {
      this.loadReservations();
    });

    document.getElementById('status-filter').addEventListener('change', () => {
      this.loadReservations();
    });

    document
      .getElementById('search-reservations')
      .addEventListener('input', (e) => {
        this.filterReservations(e.target.value);
      });

    // Customer search
    document
      .getElementById('search-customers-btn')
      .addEventListener('click', () => {
        this.searchCustomers();
      });

    // Reports
    document
      .getElementById('generate-report-btn')
      .addEventListener('click', () => {
        this.generateReport();
      });

    // Settings (admin only)
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        this.saveSettings();
      });
    }

    // Modal
    document.getElementById('close-modal').addEventListener('click', () => {
      this.closeModal();
    });

    // Close modal on outside click
    document
      .getElementById('reservation-modal')
      .addEventListener('click', (e) => {
        if (e.target.id === 'reservation-modal') {
          this.closeModal();
        }
      });
  }

  showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach((section) => {
      section.classList.add('hidden');
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('active', 'bg-blue-100', 'text-blue-700');
      item.classList.add('text-gray-600');
    });

    // Show selected section
    const section = document.getElementById(`${sectionName}-section`);
    if (section) {
      section.classList.remove('hidden');
      section.classList.add('active');
    }

    // Update nav item
    const navItem = document.getElementById(`nav-${sectionName}`);
    if (navItem) {
      navItem.classList.add('active', 'bg-blue-100', 'text-blue-700');
      navItem.classList.remove('text-gray-600');
    }

    this.currentSection = sectionName;

    // Load section-specific data
    switch (sectionName) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'reservations':
        this.loadReservations();
        break;
      case 'tables':
        this.loadTables();
        break;
      case 'customers':
        this.loadCustomers();
        break;
      case 'reports':
        this.loadReports();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  async loadDashboardData() {
    try {
      // Load today's reservations
      const today = new Date().toISOString().split('T')[0];
      const { data: todayReservations } = await supabase
        .from('reservations')
        .select('*')
        .eq('reservation_date', today);

      document.getElementById('today-reservations').textContent =
        todayReservations?.length || 0;

      // Load available tables
      const { data: tables } = await supabase
        .from('cafe_tables')
        .select('*')
        .eq('status', 'available');

      document.getElementById('available-tables').textContent =
        tables?.length || 0;

      // Load pending actions (reservations that need attention)
      const { data: pendingReservations } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['pending', 'confirmed'])
        .gte('reservation_date', today);

      document.getElementById('pending-actions').textContent =
        pendingReservations?.length || 0;

      // Load total customers
      const { data: customers } = await supabase
        .from('users')
        .select('id', { count: 'exact' });

      document.getElementById('total-customers').textContent =
        customers?.length || 0;

      // Load recent activity
      this.loadRecentActivity();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showNotification('Error loading dashboard data', 'error');
    }
  }

  async loadRecentActivity() {
    try {
      const { data: recentReservations } = await supabase
        .from('reservations')
        .select(
          `
          *,
          users(name, email),
          cafe_tables(table_number)
        `
        )
        .order('created_at', { ascending: false })
        .limit(10);

      const activityContainer = document.getElementById('recent-activity');
      activityContainer.innerHTML = '';

      if (recentReservations && recentReservations.length > 0) {
        recentReservations.forEach((reservation) => {
          const activityItem = document.createElement('div');
          activityItem.className =
            'flex items-center space-x-3 p-3 bg-gray-50 rounded-lg';

          const time = new Date(reservation.created_at).toLocaleTimeString();
          const date = new Date(
            reservation.reservation_date
          ).toLocaleDateString();

          activityItem.innerHTML = `
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">
                ${reservation.users?.name || 'Guest'} - Table ${
            reservation.cafe_tables?.table_number
          }
              </p>
              <p class="text-sm text-gray-500">
                ${date} at ${reservation.start_time} (${reservation.status})
              </p>
            </div>
            <div class="text-xs text-gray-400">
              ${time}
            </div>
          `;

          activityContainer.appendChild(activityItem);
        });
      } else {
        activityContainer.innerHTML =
          '<p class="text-gray-500 text-center">No recent activity</p>';
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }

  async loadReservations() {
    try {
      const dateFilter = document.getElementById('date-filter').value;
      const statusFilter = document.getElementById('status-filter').value;

      let query = supabase
        .from('reservations')
        .select(
          `
          *,
          users(name, email, phone),
          cafe_tables(table_number, capacity)
        `
        )
        .order('reservation_date', { ascending: true });

      if (dateFilter) {
        query = query.eq('reservation_date', dateFilter);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: reservations, error } = await query;

      if (error) throw error;

      this.reservations = reservations || [];
      this.renderReservationsTable();
    } catch (error) {
      console.error('Error loading reservations:', error);
      this.showNotification('Error loading reservations', 'error');
    }
  }

  renderReservationsTable() {
    const tbody = document.getElementById('reservations-table-body');
    tbody.innerHTML = '';

    if (this.reservations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-gray-500">
            No reservations found
          </td>
        </tr>
      `;
      return;
    }

    this.reservations.forEach((reservation) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';

      const statusColors = {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800',
        completed: 'bg-gray-100 text-gray-800',
      };

      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">
            ${reservation.users?.name || 'Guest'}
          </div>
          <div class="text-sm text-gray-500">
            ${reservation.users?.email || 'No email'}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-900">
            ${new Date(reservation.reservation_date).toLocaleDateString()}
          </div>
          <div class="text-sm text-gray-500">
            ${reservation.start_time} - ${reservation.end_time}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          Table ${reservation.cafe_tables?.table_number} (${
        reservation.cafe_tables?.capacity
      } seats)
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            statusColors[reservation.status] || 'bg-gray-100 text-gray-800'
          }">
            ${reservation.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="adminDashboard.viewReservation('${
            reservation.id
          }')" class="text-blue-600 hover:text-blue-900 mr-3">
            View
          </button>
          <button onclick="adminDashboard.editReservation('${
            reservation.id
          }')" class="text-green-600 hover:text-green-900 mr-3">
            Edit
          </button>
          <button onclick="adminDashboard.cancelReservation('${
            reservation.id
          }')" class="text-red-600 hover:text-red-900">
            Cancel
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  filterReservations(searchTerm) {
    if (!searchTerm) {
      this.renderReservationsTable();
      return;
    }

    const filtered = this.reservations.filter((reservation) => {
      const customerName = reservation.users?.name || '';
      const customerEmail = reservation.users?.email || '';
      const searchLower = searchTerm.toLowerCase();

      return (
        customerName.toLowerCase().includes(searchLower) ||
        customerEmail.toLowerCase().includes(searchLower)
      );
    });

    this.renderFilteredReservations(filtered);
  }

  renderFilteredReservations(filteredReservations) {
    const tbody = document.getElementById('reservations-table-body');
    tbody.innerHTML = '';

    if (filteredReservations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-gray-500">
            No reservations match your search
          </td>
        </tr>
      `;
      return;
    }

    filteredReservations.forEach((reservation) => {
      // Same rendering logic as renderReservationsTable
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';

      const statusColors = {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800',
        completed: 'bg-gray-100 text-gray-800',
      };

      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">
            ${reservation.users?.name || 'Guest'}
          </div>
          <div class="text-sm text-gray-500">
            ${reservation.users?.email || 'No email'}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-900">
            ${new Date(reservation.reservation_date).toLocaleDateString()}
          </div>
          <div class="text-sm text-gray-500">
            ${reservation.start_time} - ${reservation.end_time}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          Table ${reservation.cafe_tables?.table_number} (${
        reservation.cafe_tables?.capacity
      } seats)
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            statusColors[reservation.status] || 'bg-gray-100 text-gray-800'
          }">
            ${reservation.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="adminDashboard.viewReservation('${
            reservation.id
          }')" class="text-blue-600 hover:text-blue-900 mr-3">
            View
          </button>
          <button onclick="adminDashboard.editReservation('${
            reservation.id
          }')" class="text-green-600 hover:text-green-900 mr-3">
            Edit
          </button>
          <button onclick="adminDashboard.cancelReservation('${
            reservation.id
          }')" class="text-red-600 hover:text-red-900">
            Cancel
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async loadTables() {
    try {
      const { data: tables, error } = await supabase
        .from('cafe_tables')
        .select('*')
        .order('table_number');

      if (error) throw error;

      this.tables = tables || [];
      this.renderFloorPlan();
    } catch (error) {
      console.error('Error loading tables:', error);
      this.showNotification('Error loading tables', 'error');
    }
  }

  renderFloorPlan() {
    const floorPlan = document.getElementById('floor-plan');
    floorPlan.innerHTML = '';

    this.tables.forEach((table) => {
      const tableElement = document.createElement('div');
      tableElement.className = `table-item bg-white border-2 rounded-lg p-4 text-center cursor-pointer hover:shadow-md transition-shadow ${
        table.status === 'available'
          ? 'border-green-300'
          : table.status === 'occupied'
          ? 'border-red-300'
          : 'border-yellow-300'
      }`;

      tableElement.innerHTML = `
        <div class="text-lg font-semibold text-gray-900">Table ${
          table.table_number
        }</div>
        <div class="text-sm text-gray-600">${table.capacity} seats</div>
        <div class="text-xs mt-1 px-2 py-1 rounded-full ${
          table.status === 'available'
            ? 'bg-green-100 text-green-800'
            : table.status === 'occupied'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }">
          ${table.status}
        </div>
      `;

      tableElement.addEventListener('click', () => {
        this.editTable(table);
      });

      floorPlan.appendChild(tableElement);
    });
  }

  async loadCustomers() {
    try {
      const { data: customers, error } = await supabase
        .from('users')
        .select(
          `
          *,
          reservations(count)
        `
        )
        .order('name');

      if (error) throw error;

      this.customers = customers || [];
      this.renderCustomersTable();
    } catch (error) {
      console.error('Error loading customers:', error);
      this.showNotification('Error loading customers', 'error');
    }
  }

  renderCustomersTable() {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = '';

    if (this.customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-gray-500">
            No customers found
          </td>
        </tr>
      `;
      return;
    }

    this.customers.forEach((customer) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';

      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${
            customer.name || 'N/A'
          }</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
          customer.email
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
          customer.phone || 'N/A'
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
          customer.reservations?.[0]?.count || 0
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="adminDashboard.viewCustomer('${
            customer.id
          }')" class="text-blue-600 hover:text-blue-900 mr-3">
            View
          </button>
          <button onclick="adminDashboard.editCustomer('${
            customer.id
          }')" class="text-green-600 hover:text-green-900">
            Edit
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async searchCustomers() {
    const searchTerm = document.getElementById('customer-search').value;
    if (!searchTerm) {
      this.loadCustomers();
      return;
    }

    try {
      const { data: customers, error } = await supabase
        .from('users')
        .select(
          `
          *,
          reservations(count)
        `
        )
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('name');

      if (error) throw error;

      this.customers = customers || [];
      this.renderCustomersTable();
    } catch (error) {
      console.error('Error searching customers:', error);
      this.showNotification('Error searching customers', 'error');
    }
  }

  async loadReports() {
    // Set default dates
    const today = new Date();
    const startDate = document.getElementById('report-start-date');
    const endDate = document.getElementById('report-end-date');

    if (!startDate.value) {
      startDate.value = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    }
    if (!endDate.value) {
      endDate.value = today.toISOString().split('T')[0];
    }
  }

  async generateReport() {
    const reportType = document.getElementById('report-type').value;
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;

    if (!startDate || !endDate) {
      this.showNotification('Please select start and end dates', 'error');
      return;
    }

    try {
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select(
          `
          *,
          users(name, email),
          cafe_tables(table_number)
        `
        )
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate)
        .order('reservation_date');

      if (error) throw error;

      this.renderReport(reportType, reservations || [], startDate, endDate);
    } catch (error) {
      console.error('Error generating report:', error);
      this.showNotification('Error generating report', 'error');
    }
  }

  renderReport(reportType, reservations, startDate, endDate) {
    const resultsContainer = document.getElementById('report-results');

    // Calculate statistics
    const totalReservations = reservations.length;
    const confirmedReservations = reservations.filter(
      (r) => r.status === 'confirmed'
    ).length;
    const cancelledReservations = reservations.filter(
      (r) => r.status === 'cancelled'
    ).length;
    const completedReservations = reservations.filter(
      (r) => r.status === 'completed'
    ).length;

    // Group by date
    const reservationsByDate = {};
    reservations.forEach((reservation) => {
      const date = reservation.reservation_date;
      if (!reservationsByDate[date]) {
        reservationsByDate[date] = [];
      }
      reservationsByDate[date].push(reservation);
    });

    resultsContainer.innerHTML = `
      <div class="mb-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          ${
            reportType.charAt(0).toUpperCase() + reportType.slice(1)
          } Report (${startDate} to ${endDate})
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-blue-50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-blue-600">${totalReservations}</div>
            <div class="text-sm text-blue-600">Total Reservations</div>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${confirmedReservations}</div>
            <div class="text-sm text-green-600">Confirmed</div>
          </div>
          <div class="bg-red-50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-red-600">${cancelledReservations}</div>
            <div class="text-sm text-red-600">Cancelled</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-2xl font-bold text-gray-600">${completedReservations}</div>
            <div class="text-sm text-gray-600">Completed</div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="font-medium text-gray-900 mb-3">Daily Breakdown</h4>
          <div class="space-y-2">
            ${Object.entries(reservationsByDate)
              .map(
                ([date, dayReservations]) => `
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">${new Date(
                  date
                ).toLocaleDateString()}</span>
                <span class="text-sm font-medium text-gray-900">${
                  dayReservations.length
                } reservations</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  async loadSettings() {
    // Load current settings (this would typically come from a settings table)
    // For now, we'll use default values
    document.getElementById('open-time').value = '09:00';
    document.getElementById('close-time').value = '22:00';
    document.getElementById('reservation-buffer').value = '15';
  }

  async saveSettings() {
    const openTime = document.getElementById('open-time').value;
    const closeTime = document.getElementById('close-time').value;
    const reservationBuffer =
      document.getElementById('reservation-buffer').value;

    try {
      // Save settings (this would typically save to a settings table)
      // For now, we'll just show a success message
      this.showNotification('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Error saving settings', 'error');
    }
  }

  async viewReservation(reservationId) {
    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(
          `
          *,
          users(name, email, phone),
          cafe_tables(table_number, capacity)
        `
        )
        .eq('id', reservationId)
        .single();

      if (error) throw error;

      this.showReservationModal(reservation);
    } catch (error) {
      console.error('Error loading reservation details:', error);
      this.showNotification('Error loading reservation details', 'error');
    }
  }

  showReservationModal(reservation) {
    const modal = document.getElementById('reservation-modal');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <div class="space-y-4">
        <div>
          <h4 class="font-medium text-gray-900">Customer Information</h4>
          <p class="text-sm text-gray-600">Name: ${
            reservation.users?.name || 'Guest'
          }</p>
          <p class="text-sm text-gray-600">Email: ${
            reservation.users?.email || 'No email'
          }</p>
          <p class="text-sm text-gray-600">Phone: ${
            reservation.users?.phone || 'No phone'
          }</p>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-900">Reservation Details</h4>
          <p class="text-sm text-gray-600">Date: ${new Date(
            reservation.reservation_date
          ).toLocaleDateString()}</p>
          <p class="text-sm text-gray-600">Time: ${reservation.start_time} - ${
      reservation.end_time
    }</p>
          <p class="text-sm text-gray-600">Table: ${
            reservation.cafe_tables?.table_number
          } (${reservation.cafe_tables?.capacity} seats)</p>
          <p class="text-sm text-gray-600">Status: ${reservation.status}</p>
          ${
            reservation.notes
              ? `<p class="text-sm text-gray-600">Notes: ${reservation.notes}</p>`
              : ''
          }
        </div>

        <div class="flex space-x-3 pt-4">
          <button onclick="adminDashboard.editReservation('${
            reservation.id
          }')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Edit Reservation
          </button>
          <button onclick="adminDashboard.cancelReservation('${
            reservation.id
          }')" class="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
            Cancel Reservation
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('reservation-modal').classList.add('hidden');
  }

  async editReservation(reservationId) {
    // This would open an edit form
    this.showNotification('Edit functionality coming soon', 'info');
  }

  async cancelReservation(reservationId) {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId);

      if (error) throw error;

      this.showNotification('Reservation cancelled successfully', 'success');
      this.closeModal();
      this.loadReservations();
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      this.showNotification('Error cancelling reservation', 'error');
    }
  }

  editTable(table) {
    // This would open a table edit form
    this.showNotification(
      `Edit table ${table.table_number} functionality coming soon`,
      'info'
    );
  }

  viewCustomer(customerId) {
    // This would show customer details
    this.showNotification('View customer functionality coming soon', 'info');
  }

  editCustomer(customerId) {
    // This would open a customer edit form
    this.showNotification('Edit customer functionality coming soon', 'info');
  }

  setupRealTimeUpdates() {
    // Subscribe to real-time updates
    this.realTimeSubscription = supabase
      .channel('admin-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          console.log('Real-time update:', payload);
          // Refresh data based on current section
          if (this.currentSection === 'dashboard') {
            this.loadDashboardData();
          } else if (this.currentSection === 'reservations') {
            this.loadReservations();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_tables' },
        (payload) => {
          console.log('Table update:', payload);
          if (this.currentSection === 'tables') {
            this.loadTables();
          }
        }
      )
      .subscribe();
  }

  async handleLogout() {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-sm ${
      type === 'success'
        ? 'bg-green-500 text-white'
        : type === 'error'
        ? 'bg-red-500 text-white'
        : type === 'warning'
        ? 'bg-yellow-500 text-white'
        : 'bg-blue-500 text-white'
    }`;

    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
          ×
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});
