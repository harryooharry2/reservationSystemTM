/**
 * Comprehensive Reservation System
 * Handles the entire reservation flow with real-time updates
 */

// Configuration
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api';

// Import real-time service
import realtimeService from './realtime.js';

// State management
let reservationState = {
  currentStep: 1,
  selectedDate: null,
  selectedStartTime: null,
  selectedEndTime: null,
  selectedPartySize: null,
  selectedTable: null,
  availableTables: [],
  user: null,
};

// DOM elements cache
let elements = {};

/**
 * Initialize the reservation system
 */
export function initializeReservationSystem() {
  console.log('Initializing reservation system...');

  // Cache DOM elements
  cacheElements();

  // Initialize date picker
  initializeDatePicker();

  // Initialize time slots
  initializeTimeSlots();

  // Set up event listeners
  setupEventListeners();

  // Initialize real-time connections
  initializeRealTime();

  // Load user data if authenticated
  loadUserData();

  // Initialize enhanced UI/UX features
  initializeEnhancedUI();

  console.log('Reservation system initialized');
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
  elements = {
    // Step containers
    step1: document.getElementById('step-1'),
    step2: document.getElementById('step-2'),
    step3: document.getElementById('step-3'),
    step4: document.getElementById('step-4'),

    // Form inputs
    dateInput: document.getElementById('reservation-date'),
    startTimeSelect: document.getElementById('start-time'),
    endTimeSelect: document.getElementById('end-time'),
    partySizeSelect: document.getElementById('party-size'),

    // Buttons
    checkAvailabilityBtn: document.getElementById('check-availability'),
    backToStep1Btn: document.getElementById('back-to-step-1'),
    proceedToStep3Btn: document.getElementById('proceed-to-step-3'),
    backToStep2Btn: document.getElementById('back-to-step-2'),
    confirmBookingBtn: document.getElementById('confirm-booking'),
    newReservationBtn: document.getElementById('new-reservation'),
    viewReservationsBtn: document.getElementById('view-reservations'),

    // Summary elements
    summaryDate: document.getElementById('summary-date'),
    summaryTime: document.getElementById('summary-time'),
    summaryParty: document.getElementById('summary-party'),
    summaryCount: document.getElementById('summary-count'),

    // Table grid
    tableGrid: document.getElementById('table-grid'),

    // Selected table summary
    selectedTableNumber: document.getElementById('selected-table-number'),
    selectedTableCapacity: document.getElementById('selected-table-capacity'),
    selectedDate: document.getElementById('selected-date'),
    selectedTime: document.getElementById('selected-time'),

    // Booking form
    bookingForm: document.getElementById('booking-form'),
    customerName: document.getElementById('customer-name'),
    customerEmail: document.getElementById('customer-email'),
    customerPhone: document.getElementById('customer-phone'),
    specialRequests: document.getElementById('special-requests'),
    notes: document.getElementById('notes'),

    // Confirmation elements
    confirmationNumber: document.getElementById('confirmation-number'),
    confirmationTable: document.getElementById('confirmation-table'),
    confirmationDate: document.getElementById('confirmation-date'),
    confirmationTime: document.getElementById('confirmation-time'),
    confirmationParty: document.getElementById('confirmation-party'),
    confirmationName: document.getElementById('confirmation-name'),

    // Loading overlay
    loadingOverlay: document.getElementById('loading-overlay'),
  };
}

/**
 * Initialize date picker with business rules
 */
function initializeDatePicker() {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3); // 3 months in advance

  elements.dateInput.min = today.toISOString().split('T')[0];
  elements.dateInput.max = maxDate.toISOString().split('T')[0];

  // Set default to today
  elements.dateInput.value = today.toISOString().split('T')[0];
  reservationState.selectedDate = elements.dateInput.value;
}

/**
 * Initialize time slots based on business hours
 */
function initializeTimeSlots() {
  const startTimes = [];
  const endTimes = [];

  // Business hours: 8 AM to 10 PM
  for (let hour = 8; hour <= 21; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    startTimes.push(time);

    // End times start from 9 AM (1 hour after opening)
    if (hour >= 9) {
      endTimes.push(time);
    }
  }

  // Add half-hour slots
  for (let hour = 8; hour <= 21; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:30`;
    startTimes.push(time);

    if (hour >= 9) {
      endTimes.push(time);
    }
  }

  // Populate start time select
  elements.startTimeSelect.innerHTML =
    '<option value="">Select start time</option>';
  startTimes.forEach((time) => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = formatTime(time);
    elements.startTimeSelect.appendChild(option);
  });

  // Populate end time select
  elements.endTimeSelect.innerHTML =
    '<option value="">Select end time</option>';
  endTimes.forEach((time) => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = formatTime(time);
    elements.endTimeSelect.appendChild(option);
  });
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Date and time selection
  elements.dateInput.addEventListener('change', handleDateChange);
  elements.startTimeSelect.addEventListener('change', handleStartTimeChange);
  elements.endTimeSelect.addEventListener('change', handleEndTimeChange);
  elements.partySizeSelect.addEventListener('change', handlePartySizeChange);

  // Availability check
  elements.checkAvailabilityBtn.addEventListener('click', checkAvailability);

  // Navigation buttons
  elements.backToStep1Btn.addEventListener('click', () => goToStep(1));
  elements.proceedToStep3Btn.addEventListener('click', () => goToStep(3));
  elements.backToStep2Btn.addEventListener('click', () => goToStep(2));

  // Form submission
  elements.bookingForm.addEventListener('submit', handleBookingSubmission);

  // Confirmation buttons
  elements.newReservationBtn.addEventListener('click', resetReservation);
  elements.viewReservationsBtn.addEventListener('click', () => {
    window.location.href = '/profile';
  });
}

/**
 * Initialize real-time connections
 */
function initializeRealTime() {
  // Subscribe to real-time events
  realtimeService.on('table:updated', handleTableUpdate);
  realtimeService.on('reservation:created', handleReservationCreated);
  realtimeService.on('availability:updated', handleAvailabilityUpdate);
  realtimeService.on('connection:established', handleConnectionEstablished);
  realtimeService.on('connection:lost', handleConnectionLost);
  realtimeService.on('error', handleRealtimeError);

  // Subscribe to general availability updates
  realtimeService.subscribeToTableAvailability();
  realtimeService.subscribeToReservations();

  // Start heartbeat to keep connection alive
  realtimeService.startHeartbeat();
}

/**
 * Enhanced authentication integration
 */
async function loadUserData() {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        reservationState.user = userData;

        // Pre-populate form fields
        if (elements.customerName) {
          elements.customerName.value = userData.name || '';
          elements.customerName.readOnly = true;
        }
        if (elements.customerEmail) {
          elements.customerEmail.value = userData.email || '';
          elements.customerEmail.readOnly = true;
        }

        // Show authenticated user indicator
        showAuthenticatedUserIndicator(userData);

        // Join user-specific room for personal updates
        realtimeService.joinUserRoom(userData.id);

        // Update UI for authenticated user
        updateUIForAuthenticatedUser();
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('authToken');
        reservationState.user = null;
        updateUIForGuestUser();
      }
    } else {
      updateUIForGuestUser();
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    updateUIForGuestUser();
  }
}

/**
 * Show authenticated user indicator
 */
function showAuthenticatedUserIndicator(userData) {
  // Create or update user indicator
  let userIndicator = document.getElementById('user-indicator');
  if (!userIndicator) {
    userIndicator = document.createElement('div');
    userIndicator.id = 'user-indicator';
    userIndicator.className =
      'fixed top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm z-40';
    document.body.appendChild(userIndicator);
  }

  userIndicator.innerHTML = `
    <span class="flex items-center">
      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
      </svg>
      ${userData.name}
    </span>
  `;
}

/**
 * Update UI for authenticated user
 */
function updateUIForAuthenticatedUser() {
  // Add login/logout buttons to header if they don't exist
  const header = document.querySelector('header');
  if (header && !document.getElementById('auth-buttons')) {
    const authButtons = document.createElement('div');
    authButtons.id = 'auth-buttons';
    authButtons.className = 'flex items-center space-x-4';
    authButtons.innerHTML = `
      <a href="/profile" class="text-secondary-200 hover:text-primary-400 transition-colors">
        My Reservations
      </a>
      <button id="logout-btn" class="text-secondary-200 hover:text-red-400 transition-colors">
        Logout
      </button>
    `;

    // Add to header
    const nav = header.querySelector('nav');
    if (nav) {
      nav.appendChild(authButtons);
    }

    // Add logout functionality
    document
      .getElementById('logout-btn')
      .addEventListener('click', handleLogout);
  }

  // Update reservation form for authenticated user
  if (elements.customerName && elements.customerEmail) {
    elements.customerName.readOnly = true;
    elements.customerEmail.readOnly = true;

    // Add visual indicator
    elements.customerName.classList.add('bg-secondary-700');
    elements.customerEmail.classList.add('bg-secondary-700');

    // Add helper text
    const nameHelper = document.createElement('p');
    nameHelper.className = 'text-xs text-secondary-400 mt-1';
    nameHelper.textContent = 'Name from your account';
    elements.customerName.parentNode.appendChild(nameHelper);

    const emailHelper = document.createElement('p');
    emailHelper.className = 'text-xs text-secondary-400 mt-1';
    emailHelper.textContent = 'Email from your account';
    elements.customerEmail.parentNode.appendChild(emailHelper);
  }
}

/**
 * Update UI for guest user
 */
function updateUIForGuestUser() {
  // Remove user indicator
  const userIndicator = document.getElementById('user-indicator');
  if (userIndicator) {
    userIndicator.remove();
  }

  // Add login/signup buttons to header if they don't exist
  const header = document.querySelector('header');
  if (header && !document.getElementById('auth-buttons')) {
    const authButtons = document.createElement('div');
    authButtons.id = 'auth-buttons';
    authButtons.className = 'flex items-center space-x-4';
    authButtons.innerHTML = `
      <a href="/login" class="text-secondary-200 hover:text-primary-400 transition-colors">
        Login
      </a>
      <a href="/signup" class="btn-secondary px-4 py-2 rounded">
        Sign Up
      </a>
    `;

    // Add to header
    const nav = header.querySelector('nav');
    if (nav) {
      nav.appendChild(authButtons);
    }
  }

  // Update reservation form for guest user
  if (elements.customerName && elements.customerEmail) {
    elements.customerName.readOnly = false;
    elements.customerEmail.readOnly = false;

    // Remove visual indicators
    elements.customerName.classList.remove('bg-secondary-700');
    elements.customerEmail.classList.remove('bg-secondary-700');

    // Add guest user notice
    const guestNotice = document.createElement('div');
    guestNotice.className =
      'bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4';
    guestNotice.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
        </svg>
        <span class="text-blue-400 text-sm">
          <strong>Guest Booking:</strong> You can make a reservation without an account, or 
          <a href="/signup" class="underline hover:text-blue-300">create an account</a> 
          to save your preferences and view booking history.
        </span>
      </div>
    `;

    // Insert notice before the form
    const formContainer = elements.bookingForm.parentNode;
    formContainer.insertBefore(guestNotice, elements.bookingForm);
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  // Clear token and user data
  localStorage.removeItem('authToken');
  localStorage.removeItem('userReservations');
  reservationState.user = null;

  // Update UI
  updateUIForGuestUser();

  // Clear form fields
  if (elements.customerName) {
    elements.customerName.value = '';
    elements.customerName.readOnly = false;
  }
  if (elements.customerEmail) {
    elements.customerEmail.value = '';
    elements.customerEmail.readOnly = false;
  }

  // Show notification
  showNotification('You have been logged out', 'info');

  // Redirect to home page
  setTimeout(() => {
    window.location.href = '/';
  }, 1500);
}

/**
 * Event handlers
 */
function handleDateChange() {
  reservationState.selectedDate = elements.dateInput.value;
  validateStep1();
}

function handleStartTimeChange() {
  reservationState.selectedStartTime = elements.startTimeSelect.value;
  updateEndTimeOptions();
  validateStep1();
}

function handleEndTimeChange() {
  reservationState.selectedEndTime = elements.endTimeSelect.value;
  validateStep1();
}

function handlePartySizeChange() {
  reservationState.selectedPartySize = parseInt(elements.partySizeSelect.value);
  validateStep1();
}

/**
 * Real-time event handlers
 */
function handleTableUpdate(data) {
  console.log('Table update received:', data);

  // Update table card if it exists in current view
  const tableCard = document.querySelector(
    `[data-table-id="${data.table_id}"]`
  );
  if (tableCard) {
    updateTableCard(tableCard, data);
  }

  // Show notification
  showNotification(
    `Table ${data.table_number} status updated to ${data.status}`,
    'info'
  );
}

function handleReservationCreated(data) {
  console.log('Reservation created:', data);

  // Update availability if it affects current view
  if (
    data.table_id &&
    reservationState.availableTables.some((t) => t.id === data.table_id)
  ) {
    // Refresh availability after a short delay
    setTimeout(() => {
      checkAvailability();
    }, 1000);
  }

  showNotification(
    'A new reservation has been made. Availability updated.',
    'info'
  );
}

function handleAvailabilityUpdate(data) {
  console.log('Availability update:', data);

  // Refresh current availability view if we're on step 2
  if (reservationState.currentStep === 2) {
    checkAvailability();
  }
}

function handleConnectionEstablished() {
  console.log('Real-time connection established');
  showNotification('Real-time updates connected', 'success');
}

function handleConnectionLost(data) {
  console.log('Real-time connection lost:', data);
  showNotification(
    'Real-time connection lost. Trying to reconnect...',
    'warning'
  );
}

function handleRealtimeError(error) {
  console.error('Real-time error:', error);
  showNotification('Real-time connection error', 'error');
}

/**
 * Update end time options based on selected start time
 */
function updateEndTimeOptions() {
  if (!reservationState.selectedStartTime) return;

  const startTime = reservationState.selectedStartTime;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;

  // Clear current options
  elements.endTimeSelect.innerHTML =
    '<option value="">Select end time</option>';

  // Add valid end times (minimum 30 minutes, maximum 4 hours)
  for (let hour = 8; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`;
      const [endHour, endMinute] = time.split(':').map(Number);
      const endMinutes = endHour * 60 + endMinute;

      const duration = endMinutes - startMinutes;

      if (duration >= 30 && duration <= 240 && endMinutes > startMinutes) {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = formatTime(time);
        elements.endTimeSelect.appendChild(option);
      }
    }
  }
}

/**
 * Validate step 1 inputs
 */
function validateStep1() {
  const isValid =
    reservationState.selectedDate &&
    reservationState.selectedStartTime &&
    reservationState.selectedEndTime &&
    reservationState.selectedPartySize;

  elements.checkAvailabilityBtn.disabled = !isValid;
  return isValid;
}

/**
 * Check table availability
 */
async function checkAvailability() {
  if (!validateStep1()) return;

  showLoading(true);

  try {
    const params = new URLSearchParams({
      date: reservationState.selectedDate,
      start_time: reservationState.selectedStartTime,
      end_time: reservationState.selectedEndTime,
      party_size: reservationState.selectedPartySize,
    });

    const response = await fetch(
      `${API_BASE}/reservations/availability?${params}`
    );

    if (!response.ok) {
      throw new Error('Failed to check availability');
    }

    const data = await response.json();
    reservationState.availableTables = data.data || [];

    // Update summary
    updateAvailabilitySummary();

    // Render table grid
    renderTableGrid();

    // Go to step 2
    goToStep(2);
  } catch (error) {
    console.error('Error checking availability:', error);
    showError('Failed to check availability. Please try again.');
  } finally {
    showLoading(false);
  }
}

/**
 * Update availability summary
 */
function updateAvailabilitySummary() {
  elements.summaryDate.textContent = formatDate(reservationState.selectedDate);
  elements.summaryTime.textContent = `${formatTime(
    reservationState.selectedStartTime
  )} - ${formatTime(reservationState.selectedEndTime)}`;
  elements.summaryParty.textContent = `${reservationState.selectedPartySize} ${
    reservationState.selectedPartySize === 1 ? 'person' : 'people'
  }`;
  elements.summaryCount.textContent = reservationState.availableTables.length;
}

/**
 * Render table grid
 */
function renderTableGrid() {
  elements.tableGrid.innerHTML = '';

  reservationState.availableTables.forEach((table) => {
    const tableCard = createTableCard(table);
    elements.tableGrid.appendChild(tableCard);
  });

  // Add event listeners to table cards
  document.querySelectorAll('.table-card').forEach((card) => {
    card.addEventListener('click', handleTableSelection);
  });
}

/**
 * Enhanced conflict handling with optimistic locking and real-time detection
 */
let conflictDetectionInterval = null;
let lastAvailabilityCheck = null;

/**
 * Start conflict detection monitoring
 */
function startConflictDetection() {
  // Clear any existing interval
  if (conflictDetectionInterval) {
    clearInterval(conflictDetectionInterval);
  }

  // Check for conflicts every 5 seconds while on step 2 or 3
  conflictDetectionInterval = setInterval(() => {
    if (reservationState.currentStep >= 2 && reservationState.selectedTable) {
      checkForConflicts();
    }
  }, 5000);
}

/**
 * Stop conflict detection monitoring
 */
function stopConflictDetection() {
  if (conflictDetectionInterval) {
    clearInterval(conflictDetectionInterval);
    conflictDetectionInterval = null;
  }
}

/**
 * Check for conflicts with current selection
 */
async function checkForConflicts() {
  if (
    !reservationState.selectedDate ||
    !reservationState.selectedStartTime ||
    !reservationState.selectedEndTime
  ) {
    return;
  }

  try {
    const params = new URLSearchParams({
      date: reservationState.selectedDate,
      start_time: reservationState.selectedStartTime,
      end_time: reservationState.selectedEndTime,
      party_size: reservationState.selectedPartySize,
    });

    const response = await fetch(
      `${API_BASE}/reservations/availability?${params}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Failed to check availability');
    }

    // Check if our selected table is still available
    const selectedTableStillAvailable = data.data.some(
      (table) =>
        table.id === reservationState.selectedTable.id && table.is_available
    );

    if (!selectedTableStillAvailable) {
      handleConflictDetected();
    } else {
      // Update availability count
      const availableCount = data.data.filter(
        (table) => table.is_available
      ).length;
      updateAvailabilityCount(availableCount);
    }

    lastAvailabilityCheck = Date.now();
  } catch (error) {
    console.error('Error checking for conflicts:', error);
  }
}

/**
 * Handle conflict detection
 */
function handleConflictDetected() {
  // Show conflict warning
  showConflictWarning();

  // Update table grid to reflect current availability
  checkAvailability();

  // If we're on step 3, prevent form submission
  if (reservationState.currentStep === 3) {
    elements.confirmBookingBtn.disabled = true;
    elements.confirmBookingBtn.textContent = 'Table No Longer Available';
    elements.confirmBookingBtn.classList.add('bg-red-500');
  }
}

/**
 * Show conflict warning to user
 */
function showConflictWarning() {
  const warningMessage =
    'The table you selected is no longer available. Please select a different table or time.';

  // Create or update conflict warning
  let conflictWarning = document.getElementById('conflict-warning');
  if (!conflictWarning) {
    conflictWarning = document.createElement('div');
    conflictWarning.id = 'conflict-warning';
    conflictWarning.className =
      'bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4';
    conflictWarning.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
        </svg>
        <span class="text-red-400 font-medium">Table Conflict Detected</span>
      </div>
      <p class="text-red-300 text-sm mt-2">${warningMessage}</p>
      <button id="dismiss-conflict" class="text-red-300 hover:text-red-200 text-sm mt-2 underline">
        Dismiss
      </button>
    `;

    // Insert warning at the top of the current step
    const currentStep = elements[`step${reservationState.currentStep}`];
    if (currentStep) {
      currentStep.insertBefore(conflictWarning, currentStep.firstChild);
    }

    // Add dismiss functionality
    document
      .getElementById('dismiss-conflict')
      .addEventListener('click', () => {
        conflictWarning.remove();
      });
  }

  // Show notification
  showNotification(warningMessage, 'warning');
}

/**
 * Update availability count display
 */
function updateAvailabilityCount(count) {
  const countElement = document.getElementById('summary-count');
  if (countElement) {
    countElement.textContent = count;

    // Update color based on availability
    if (count === 0) {
      countElement.classList.add('text-red-400');
      countElement.classList.remove('text-green-400', 'text-yellow-400');
    } else if (count <= 2) {
      countElement.classList.add('text-yellow-400');
      countElement.classList.remove('text-green-400', 'text-red-400');
    } else {
      countElement.classList.add('text-green-400');
      countElement.classList.remove('text-yellow-400', 'text-red-400');
    }
  }
}

/**
 * Enhanced table selection with conflict prevention
 */
function handleTableSelection(event) {
  const card = event.currentTarget;
  const tableId = card.dataset.tableId;
  const capacity = parseInt(card.dataset.capacity);

  // Remove previous selection
  document.querySelectorAll('.table-card.selected').forEach((c) => {
    c.classList.remove('selected');
  });

  // Check if table is available
  const isAvailable = card.classList.contains('available');

  if (isAvailable) {
    // Double-check availability before selection
    checkTableAvailability(tableId).then((stillAvailable) => {
      if (stillAvailable) {
        card.classList.add('selected');
        reservationState.selectedTable = {
          id: parseInt(tableId),
          capacity: capacity,
          table_number: card
            .querySelector('.text-lg')
            .textContent.replace('Table ', ''),
        };

        elements.proceedToStep3Btn.disabled = false;

        // Join table-specific room for updates
        realtimeService.joinTableRoom(tableId);

        // Start conflict detection
        startConflictDetection();

        showNotification(
          `Table ${reservationState.selectedTable.table_number} selected`,
          'success'
        );
      } else {
        // Table became unavailable
        card.classList.remove('available');
        card.classList.add('unavailable');
        showError(
          'This table is no longer available. Please select another table.'
        );
      }
    });
  } else {
    showError('This table is not available for your party size or time slot.');
  }
}

/**
 * Check if a specific table is still available
 */
async function checkTableAvailability(tableId) {
  try {
    const params = new URLSearchParams({
      date: reservationState.selectedDate,
      start_time: reservationState.selectedStartTime,
      end_time: reservationState.selectedEndTime,
      party_size: reservationState.selectedPartySize,
    });

    const response = await fetch(
      `${API_BASE}/reservations/availability?${params}`
    );
    const data = await response.json();

    if (response.ok) {
      const table = data.data.find((t) => t.id === parseInt(tableId));
      return table && table.is_available;
    }
  } catch (error) {
    console.error('Error checking table availability:', error);
  }
  return false;
}

/**
 * Navigate between steps
 */
function goToStep(step) {
  // Validate current step before proceeding
  if (step > reservationState.currentStep) {
    if (!validateCurrentStep()) {
      return;
    }
  }

  // Stop conflict detection when leaving step 2 or 3
  if (reservationState.currentStep >= 2 && step < 2) {
    stopConflictDetection();
  }

  // Start conflict detection when entering step 2 or 3
  if (step >= 2 && reservationState.currentStep < 2) {
    startConflictDetection();
  }

  // Hide all steps
  Object.values(elements).forEach((element) => {
    if (
      element &&
      element.classList &&
      element.classList.contains('reservation-step')
    ) {
      element.classList.add('hidden');
      element.classList.remove('active');
    }
  });

  // Show target step
  const targetStep = elements[`step${step}`];
  if (targetStep) {
    targetStep.classList.remove('hidden');
    targetStep.classList.add('active');
    reservationState.currentStep = step;
  }

  // Update selected table summary if going to step 3
  if (step === 3 && reservationState.selectedTable) {
    updateSelectedTableSummary();
  }

  // Scroll to top of the new step
  targetStep?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Update selected table summary
 */
function updateSelectedTableSummary() {
  elements.selectedTableNumber.textContent =
    reservationState.selectedTable.table_number;
  elements.selectedTableCapacity.textContent =
    reservationState.selectedTable.capacity;
  elements.selectedDate.textContent = formatDate(reservationState.selectedDate);
  elements.selectedTime.textContent = `${formatTime(
    reservationState.selectedStartTime
  )} - ${formatTime(reservationState.selectedEndTime)}`;
}

/**
 * Validate current step before proceeding
 */
function validateCurrentStep() {
  switch (reservationState.currentStep) {
    case 1:
      return validateStep1();
    case 2:
      return reservationState.selectedTable !== null;
    case 3:
      return validateBookingForm();
    default:
      return true;
  }
}

/**
 * Validate booking form with enhanced validation
 */
function validateBookingForm() {
  const requiredFields = ['customer-name', 'customer-email'];
  const errors = [];

  // Check required fields
  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field.value.trim()) {
      errors.push(
        `${field.placeholder || fieldId.replace('-', ' ')} is required`
      );
      field.classList.add('error');
    } else {
      field.classList.remove('error');
    }
  }

  // Validate email format
  const email = elements.customerEmail.value;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
    elements.customerEmail.classList.add('error');
  } else if (email) {
    elements.customerEmail.classList.remove('error');
  }

  // Validate phone number if provided
  const phone = elements.customerPhone.value;
  if (phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Please enter a valid phone number');
      elements.customerPhone.classList.add('error');
    } else {
      elements.customerPhone.classList.remove('error');
    }
  }

  // Validate party size against table capacity
  if (reservationState.selectedTable && reservationState.selectedPartySize) {
    if (
      reservationState.selectedPartySize >
      reservationState.selectedTable.capacity
    ) {
      errors.push(
        `Party size (${reservationState.selectedPartySize}) exceeds table capacity (${reservationState.selectedTable.capacity})`
      );
    }
  }

  // Show errors if any
  if (errors.length > 0) {
    showError(errors.join('\n'));
    return false;
  }

  return true;
}

/**
 * Enhanced booking submission with conflict prevention
 */
async function handleBookingSubmission(event) {
  event.preventDefault();

  if (!validateBookingForm()) return;

  // Final conflict check before submission
  const finalAvailabilityCheck = await checkTableAvailability(
    reservationState.selectedTable.id
  );
  if (!finalAvailabilityCheck) {
    showError(
      'This table is no longer available. Please select a different table or time.'
    );
    // Go back to table selection
    goToStep(2);
    return;
  }

  // Check if user is authenticated
  const token = localStorage.getItem('authToken');
  const isAuthenticated = !!token;

  // Disable submit button to prevent double submission
  elements.confirmBookingBtn.disabled = true;
  elements.confirmBookingBtn.textContent = 'Creating Reservation...';

  showLoading(true);

  try {
    const bookingData = {
      table_id: reservationState.selectedTable.id,
      reservation_date: reservationState.selectedDate,
      start_time: reservationState.selectedStartTime,
      end_time: reservationState.selectedEndTime,
      party_size: reservationState.selectedPartySize,
      notes: elements.notes.value,
    };

    // Add customer details
    bookingData.customer_name = elements.customerName.value.trim();
    bookingData.customer_email = elements.customerEmail.value.trim();
    if (elements.customerPhone.value.trim()) {
      bookingData.customer_phone = elements.customerPhone.value.trim();
    }
    if (elements.specialRequests.value) {
      bookingData.special_requests = elements.specialRequests.value;
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bookingData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();

      // Handle specific conflict errors
      if (response.status === 409) {
        showError(
          'This time slot is no longer available. Please select a different time or table.'
        );
        // Go back to table selection
        goToStep(2);
        return;
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        reservationState.user = null;
        updateUIForGuestUser();
        throw new Error(
          'Your session has expired. Please log in again to continue.'
        );
      }

      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to create reservation`
      );
    }

    const result = await response.json();

    // Stop conflict detection since reservation is confirmed
    stopConflictDetection();

    // Show success notification
    const successMessage = isAuthenticated
      ? 'Reservation created successfully! Check your email for confirmation.'
      : 'Reservation created successfully! Please check your email for confirmation.';
    showNotification(successMessage, 'success');

    // Show confirmation
    showConfirmation(result.data);
  } catch (error) {
    console.error('Error creating reservation:', error);

    let errorMessage = 'Failed to create reservation. Please try again.';

    if (error.name === 'AbortError') {
      errorMessage =
        'Request timed out. Please check your connection and try again.';
    } else if (error.message.includes('409')) {
      errorMessage =
        'This time slot is no longer available. Please select a different time or table.';
    } else if (error.message.includes('401')) {
      errorMessage = 'Please log in to create a reservation.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    showError(errorMessage);
  } finally {
    showLoading(false);

    // Re-enable submit button
    elements.confirmBookingBtn.disabled = false;
    elements.confirmBookingBtn.textContent = 'Confirm Reservation';
    elements.confirmBookingBtn.classList.remove('bg-red-500');
  }
}

/**
 * Enhanced confirmation screen with QR code and email confirmation
 */
function showConfirmation(reservationData) {
  // Populate confirmation details
  elements.confirmationNumber.textContent = reservationData.id || 'N/A';
  elements.confirmationTable.textContent =
    reservationState.selectedTable.table_number;
  elements.confirmationDate.textContent = formatDate(
    reservationState.selectedDate
  );
  elements.confirmationTime.textContent = `${formatTime(
    reservationState.selectedStartTime
  )} - ${formatTime(reservationState.selectedEndTime)}`;
  elements.confirmationParty.textContent = `${
    reservationState.selectedPartySize
  } ${reservationState.selectedPartySize === 1 ? 'person' : 'people'}`;
  elements.confirmationName.textContent = elements.customerName.value;

  // Generate QR code for the reservation
  generateQRCode(reservationData.id);

  // Store reservation in localStorage for later access
  const userReservations = JSON.parse(
    localStorage.getItem('userReservations') || '[]'
  );
  const reservationRecord = {
    id: reservationData.id,
    table: reservationState.selectedTable.table_number,
    date: reservationState.selectedDate,
    time: `${reservationState.selectedStartTime} - ${reservationState.selectedEndTime}`,
    partySize: reservationState.selectedPartySize,
    name: elements.customerName.value,
    email: elements.customerEmail.value,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  userReservations.push(reservationRecord);
  localStorage.setItem('userReservations', JSON.stringify(userReservations));

  // Simulate email confirmation
  simulateEmailConfirmation(reservationRecord);

  // Go to confirmation step
  goToStep(4);

  // Send analytics event if available
  if (typeof gtag !== 'undefined') {
    gtag('event', 'reservation_created', {
      event_category: 'booking',
      event_label: reservationData.id,
      value: reservationState.selectedPartySize,
    });
  }

  // Add confirmation actions
  setupConfirmationActions(reservationData.id);
}

/**
 * Generate QR code for reservation
 */
function generateQRCode(reservationId) {
  // Create QR code container if it doesn't exist
  let qrContainer = document.getElementById('qr-code-container');
  if (!qrContainer) {
    qrContainer = document.createElement('div');
    qrContainer.id = 'qr-code-container';
    qrContainer.className = 'text-center mb-4';

    // Insert after confirmation details
    const confirmationDetails = document.getElementById('confirmation-details');
    if (confirmationDetails) {
      confirmationDetails.parentNode.insertBefore(
        qrContainer,
        confirmationDetails.nextSibling
      );
    }
  }

  // Generate QR code data
  const qrData = JSON.stringify({
    reservationId: reservationId,
    table: reservationState.selectedTable.table_number,
    date: reservationState.selectedDate,
    time: reservationState.selectedStartTime,
    name: elements.customerName.value,
  });

  // Create QR code using a simple text representation (in production, use a QR library)
  qrContainer.innerHTML = `
    <div class="bg-white p-4 rounded-lg inline-block">
      <div class="text-xs font-mono text-gray-800 mb-2">QR Code</div>
      <div class="text-xs font-mono text-gray-600 break-all max-w-xs">
        ${qrData}
      </div>
      <div class="text-xs text-gray-500 mt-2">
        Show this to staff for quick check-in
      </div>
    </div>
  `;
}

/**
 * Simulate email confirmation
 */
function simulateEmailConfirmation(reservationRecord) {
  // Create email confirmation simulation
  const emailConfirmation = {
    to: reservationRecord.email,
    subject: `Reservation Confirmation #${reservationRecord.id}`,
    body: `
Dear ${reservationRecord.name},

Your reservation has been confirmed!

Reservation Details:
- Confirmation #: ${reservationRecord.id}
- Date: ${formatDate(reservationRecord.date)}
- Time: ${reservationRecord.time}
- Table: ${reservationRecord.table}
- Party Size: ${reservationRecord.partySize} ${
      reservationRecord.partySize === 1 ? 'person' : 'people'
    }

Please arrive 5 minutes before your reservation time. If you need to modify or cancel your reservation, please contact us at least 2 hours in advance.

Thank you for choosing our cafe!

Best regards,
The Cafe Team
    `.trim(),
  };

  // Store email confirmation in localStorage for demo purposes
  const emailConfirmations = JSON.parse(
    localStorage.getItem('emailConfirmations') || '[]'
  );
  emailConfirmations.push(emailConfirmation);
  localStorage.setItem(
    'emailConfirmations',
    JSON.stringify(emailConfirmations)
  );

  // Show email confirmation notification
  setTimeout(() => {
    showNotification(
      'Confirmation email sent to your email address',
      'success'
    );
  }, 2000);
}

/**
 * Setup confirmation actions
 */
function setupConfirmationActions(reservationId) {
  // Add action buttons to confirmation screen
  const actionButtons = document.createElement('div');
  actionButtons.className = 'mt-6 space-y-3';
  actionButtons.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3">
      <button id="download-confirmation" class="btn-secondary flex-1">
        <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        Download Confirmation
      </button>
      <button id="share-reservation" class="btn-secondary flex-1">
        <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
        </svg>
        Share Reservation
      </button>
    </div>
    <div class="flex flex-col sm:flex-row gap-3">
      <button id="modify-reservation" class="btn-secondary flex-1">
        <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
        Modify Reservation
      </button>
      <button id="cancel-reservation" class="btn-secondary flex-1 text-red-400 hover:text-red-300">
        <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Cancel Reservation
      </button>
    </div>
  `;

  // Insert action buttons before the existing buttons
  const existingButtons = document.querySelector('#step-4 .space-y-4');
  if (existingButtons) {
    existingButtons.insertBefore(actionButtons, existingButtons.firstChild);
  }

  // Add event listeners
  document
    .getElementById('download-confirmation')
    .addEventListener('click', () => {
      downloadConfirmation(reservationId);
    });

  document.getElementById('share-reservation').addEventListener('click', () => {
    shareReservation(reservationId);
  });

  document
    .getElementById('modify-reservation')
    .addEventListener('click', () => {
      modifyReservation(reservationId);
    });

  document
    .getElementById('cancel-reservation')
    .addEventListener('click', () => {
      cancelReservation(reservationId);
    });
}

/**
 * Download confirmation as PDF/text
 */
function downloadConfirmation(reservationId) {
  const reservation = JSON.parse(
    localStorage.getItem('userReservations') || '[]'
  ).find((r) => r.id === reservationId);

  if (!reservation) {
    showError('Reservation not found');
    return;
  }

  const confirmationText = `
CAFE RESERVATION CONFIRMATION

Confirmation #: ${reservation.id}
Name: ${reservation.name}
Date: ${formatDate(reservation.date)}
Time: ${reservation.time}
Table: ${reservation.table}
Party Size: ${reservation.partySize} ${
    reservation.partySize === 1 ? 'person' : 'people'
  }
Status: ${reservation.status}

Please arrive 5 minutes before your reservation time.
If you need to modify or cancel, please contact us at least 2 hours in advance.

Thank you for choosing our cafe!
  `.trim();

  // Create and download file
  const blob = new Blob([confirmationText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservation-${reservationId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification('Confirmation downloaded successfully', 'success');
}

/**
 * Share reservation
 */
function shareReservation(reservationId) {
  const reservation = JSON.parse(
    localStorage.getItem('userReservations') || '[]'
  ).find((r) => r.id === reservationId);

  if (!reservation) {
    showError('Reservation not found');
    return;
  }

  const shareText = `I have a reservation at the cafe on ${formatDate(
    reservation.date
  )} at ${reservation.time} for ${reservation.partySize} ${
    reservation.partySize === 1 ? 'person' : 'people'
  }. Confirmation #${reservation.id}`;

  if (navigator.share) {
    navigator
      .share({
        title: 'Cafe Reservation',
        text: shareText,
        url: window.location.href,
      })
      .catch(console.error);
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard
      .writeText(shareText)
      .then(() => {
        showNotification('Reservation details copied to clipboard', 'success');
      })
      .catch(() => {
        showError('Failed to copy to clipboard');
      });
  }
}

/**
 * Modify reservation
 */
function modifyReservation(reservationId) {
  // For now, redirect to reservations page with modification intent
  // In a full implementation, this would load the reservation data back into the form
  showNotification(
    'Modification feature coming soon. Please contact us directly.',
    'info'
  );
}

/**
 * Cancel reservation
 */
function cancelReservation(reservationId) {
  if (
    !confirm(
      'Are you sure you want to cancel this reservation? This action cannot be undone.'
    )
  ) {
    return;
  }

  const token = localStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Call API to cancel reservation
  fetch(`${API_BASE}/reservations/${reservationId}`, {
    method: 'DELETE',
    headers,
  })
    .then((response) => {
      if (response.ok) {
        // Remove from localStorage
        const userReservations = JSON.parse(
          localStorage.getItem('userReservations') || '[]'
        );
        const updatedReservations = userReservations.filter(
          (r) => r.id !== reservationId
        );
        localStorage.setItem(
          'userReservations',
          JSON.stringify(updatedReservations)
        );

        showNotification('Reservation cancelled successfully', 'success');

        // Redirect to home page
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        throw new Error('Failed to cancel reservation');
      }
    })
    .catch((error) => {
      console.error('Error cancelling reservation:', error);
      showError(
        'Failed to cancel reservation. Please try again or contact us directly.'
      );
    });
}

/**
 * Clean up conflict detection on page unload
 */
window.addEventListener('beforeunload', () => {
  stopConflictDetection();
});

/**
 * Enhanced reset function with conflict detection cleanup
 */
function resetReservation() {
  // Stop conflict detection
  stopConflictDetection();

  // Reset state
  reservationState = {
    currentStep: 1,
    selectedDate: null,
    selectedStartTime: null,
    selectedEndTime: null,
    selectedPartySize: null,
    selectedTable: null,
    availableTables: [],
    user: reservationState.user,
  };

  // Reset form
  elements.bookingForm.reset();
  elements.dateInput.value = new Date().toISOString().split('T')[0];
  elements.startTimeSelect.value = '';
  elements.endTimeSelect.value = '';
  elements.partySizeSelect.value = '';

  // Clear any conflict warnings
  const conflictWarning = document.getElementById('conflict-warning');
  if (conflictWarning) {
    conflictWarning.remove();
  }

  // Reset button states
  elements.confirmBookingBtn.disabled = false;
  elements.confirmBookingBtn.textContent = 'Confirm Reservation';
  elements.confirmBookingBtn.classList.remove('bg-red-500');

  // Go back to step 1
  goToStep(1);

  // Re-initialize
  initializeDatePicker();
  validateStep1();
}

/**
 * Utility functions
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Enhanced UI/UX features
 */

/**
 * Update progress indicator
 */
function updateProgressIndicator(currentStep) {
  // Update step indicators
  for (let i = 1; i <= 4; i++) {
    const stepElement = document.getElementById(`progress-step-${i}`);
    const lineElement = document.getElementById(`progress-line-${i}`);

    if (stepElement) {
      stepElement.classList.remove('active', 'completed');
      if (i < currentStep) {
        stepElement.classList.add('completed');
      } else if (i === currentStep) {
        stepElement.classList.add('active');
      }
    }

    if (lineElement && i < 4) {
      lineElement.classList.remove('active', 'completed');
      if (i < currentStep) {
        lineElement.classList.add('completed');
      } else if (i === currentStep - 1) {
        lineElement.classList.add('active');
      }
    }
  }
}

/**
 * Show skeleton loading
 */
function showSkeletonLoading(step) {
  // Hide all steps
  Object.values(elements).forEach((element) => {
    if (
      element &&
      element.classList &&
      element.classList.contains('reservation-step')
    ) {
      element.classList.add('hidden');
      element.classList.remove('active');
    }
  });

  // Show skeleton for specific step
  const skeletonElement = document.getElementById(`step-${step}-skeleton`);
  if (skeletonElement) {
    skeletonElement.classList.remove('hidden');
    skeletonElement.classList.add('active');
  }
}

/**
 * Hide skeleton loading
 */
function hideSkeletonLoading() {
  const skeletonContainer = document.getElementById('skeleton-loading');
  if (skeletonContainer) {
    skeletonContainer.classList.add('hidden');
  }
}

/**
 * Enhanced notification system with toast
 */
function showNotification(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  // Add close button for accessibility
  const closeButton = document.createElement('button');
  closeButton.className =
    'absolute top-2 right-2 text-white opacity-70 hover:opacity-100';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close notification');
  closeButton.addEventListener('click', () => {
    hideToast(toast);
  });

  toast.innerHTML = `
    <div class="flex items-start">
      <div class="flex-1">
        <p class="text-sm font-medium">${message}</p>
      </div>
    </div>
  `;
  toast.appendChild(closeButton);

  document.body.appendChild(toast);

  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideToast(toast);
  }, 5000);
}

/**
 * Hide toast notification
 */
function hideToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Enhanced loading state management
 */
function showLoading(show, message = 'Processing your reservation...') {
  if (elements.loadingOverlay) {
    if (show) {
      elements.loadingOverlay.classList.remove('hidden');
      const messageElement = elements.loadingOverlay.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      }
    } else {
      elements.loadingOverlay.classList.add('hidden');
    }
  }
}

/**
 * Enhanced table card creation with accessibility
 */
function createTableCard(table) {
  const card = document.createElement('div');
  card.className =
    'table-card bg-card border-2 border-secondary-700 rounded-lg p-4 cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2';
  card.dataset.tableId = table.id;
  card.dataset.capacity = table.capacity;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute(
    'aria-label',
    `Table ${table.table_number}, Capacity: ${table.capacity}, Status: ${table.status}`
  );

  const isAvailable =
    table.status === 'available' &&
    table.capacity >= reservationState.selectedPartySize;

  if (isAvailable) {
    card.classList.add('available');
    card.setAttribute('aria-pressed', 'false');
  } else {
    card.classList.add('unavailable');
    card.setAttribute('aria-disabled', 'true');
  }

  card.innerHTML = `
    <div class="text-lg font-semibold text-secondary-200 mb-2">Table ${
      table.table_number
    }</div>
    <div class="text-sm text-secondary-400 mb-2">Capacity: ${
      table.capacity
    }</div>
    <div class="text-xs text-secondary-500">${table.description || ''}</div>
    <div class="mt-2">
      <span class="badge ${isAvailable ? 'badge-success' : 'badge-error'}">
        ${isAvailable ? 'Available' : 'Unavailable'}
      </span>
    </div>
  `;

  // Add keyboard support
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isAvailable) {
        handleTableSelection({ currentTarget: card });
      }
    }
  });

  return card;
}

/**
 * Enhanced error handling with better user feedback
 */
function showError(message) {
  showNotification(message, 'error');

  // Log error for debugging
  console.error('Reservation Error:', message);

  // Add error tracking if available
  if (typeof gtag !== 'undefined') {
    gtag('event', 'reservation_error', {
      event_category: 'booking',
      event_label: message,
      value: 1,
    });
  }
}

/**
 * Performance optimization: Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Debounced availability check
 */
const debouncedAvailabilityCheck = debounce(checkAvailability, 500);

/**
 * Enhanced form validation with real-time feedback
 */
function setupRealTimeValidation() {
  // Real-time email validation
  elements.customerEmail?.addEventListener(
    'input',
    debounce(() => {
      const email = elements.customerEmail.value;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (email && !emailRegex.test(email)) {
        elements.customerEmail.classList.add('error');
        showFieldError(
          elements.customerEmail,
          'Please enter a valid email address'
        );
      } else {
        elements.customerEmail.classList.remove('error');
        clearFieldError(elements.customerEmail);
      }
    }, 300)
  );

  // Real-time phone validation
  elements.customerPhone?.addEventListener(
    'input',
    debounce(() => {
      const phone = elements.customerPhone.value;
      if (phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
          elements.customerPhone.classList.add('error');
          showFieldError(
            elements.customerPhone,
            'Please enter a valid phone number'
          );
        } else {
          elements.customerPhone.classList.remove('error');
          clearFieldError(elements.customerPhone);
        }
      }
    }, 300)
  );
}

/**
 * Show field-specific error
 */
function showFieldError(field, message) {
  clearFieldError(field);

  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  errorElement.setAttribute('role', 'alert');

  field.parentNode.appendChild(errorElement);
}

/**
 * Clear field-specific error
 */
function clearFieldError(field) {
  const existingError = field.parentNode.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }
}

/**
 * Initialize enhanced UI/UX features
 */
function initializeEnhancedUI() {
  // Setup real-time validation
  setupRealTimeValidation();

  // Initialize progress indicator
  updateProgressIndicator(1);

  // Add keyboard navigation support
  setupKeyboardNavigation();

  // Add performance monitoring
  setupPerformanceMonitoring();
}

/**
 * Setup keyboard navigation
 */
function setupKeyboardNavigation() {
  // Handle escape key to go back
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (reservationState.currentStep > 1) {
        goToStep(reservationState.currentStep - 1);
      }
    }
  });
}

/**
 * Setup performance monitoring
 */
function setupPerformanceMonitoring() {
  // Monitor page load performance
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData && perfData.loadEventEnd > 3000) {
        console.warn(
          'Page load time exceeded 3 seconds:',
          perfData.loadEventEnd
        );
      }
    });
  }
}

// Export for use in other modules
export { reservationState, elements };
