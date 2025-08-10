-- Enhanced conflict prevention functions for Task 6.3
-- Time buffer system and stronger validation

-- Function to check table availability with time buffer (15-minute gaps)
CREATE OR REPLACE FUNCTION check_table_availability_with_buffer(
  p_table_id INTEGER,
  p_reservation_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_buffer_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  buffer_start TIME;
  buffer_end TIME;
  conflicting_reservations INTEGER;
BEGIN
  -- Calculate buffer times
  buffer_start := p_start_time - INTERVAL '1 minute' * p_buffer_minutes;
  buffer_end := p_end_time + INTERVAL '1 minute' * p_buffer_minutes;
  
  -- Check for conflicting reservations including buffer time
  SELECT COUNT(*) INTO conflicting_reservations
  FROM reservations r
  WHERE r.table_id = p_table_id
    AND r.reservation_date = p_reservation_date
    AND r.status IN ('confirmed', 'pending')
    AND (
      -- Check if new reservation overlaps with existing ones (including buffer)
      (p_start_time < r.end_time + INTERVAL '1 minute' * p_buffer_minutes)
      AND (p_end_time + INTERVAL '1 minute' * p_buffer_minutes > r.start_time)
    );
  
  RETURN conflicting_reservations = 0;
END;
$$;

-- Function to validate table capacity against party size
CREATE OR REPLACE FUNCTION validate_table_capacity(
  p_table_id INTEGER,
  p_party_size INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_capacity INTEGER;
BEGIN
  SELECT capacity INTO table_capacity
  FROM cafe_tables
  WHERE id = p_table_id;
  
  IF table_capacity IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN p_party_size <= table_capacity;
END;
$$;

-- Function to get available tables with capacity filtering and time buffer
CREATE OR REPLACE FUNCTION get_available_tables_with_buffer(
  p_reservation_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_party_size INTEGER DEFAULT NULL,
  p_buffer_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  table_id INTEGER,
  table_number VARCHAR,
  capacity INTEGER,
  status VARCHAR,
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id,
    ct.table_number,
    ct.capacity,
    ct.status,
    CASE 
      WHEN ct.status = 'available' 
        AND (p_party_size IS NULL OR ct.capacity >= p_party_size)
        AND check_table_availability_with_buffer(ct.id, p_reservation_date, p_start_time, p_end_time, p_buffer_minutes)
      THEN TRUE
      ELSE FALSE
    END as is_available
  FROM cafe_tables ct
  WHERE ct.status != 'maintenance'
  ORDER BY ct.capacity ASC, ct.table_number ASC;
END;
$$;

-- Function to create reservation with transaction and conflict prevention
CREATE OR REPLACE FUNCTION create_reservation_safe(
  p_user_id UUID,
  p_table_id INTEGER,
  p_reservation_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_party_size INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_buffer_minutes INTEGER DEFAULT 15
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reservation_id INTEGER;
  table_capacity INTEGER;
  is_available BOOLEAN;
  result JSON;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if table exists and get capacity
    SELECT capacity INTO table_capacity
    FROM cafe_tables
    WHERE id = p_table_id;
    
    IF table_capacity IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Validate party size against capacity
    IF p_party_size IS NOT NULL AND p_party_size > table_capacity THEN
      RETURN json_build_object('success', false, 'error', 'Party size exceeds table capacity');
    END IF;
    
    -- Check availability with buffer
    SELECT check_table_availability_with_buffer(p_table_id, p_reservation_date, p_start_time, p_end_time, p_buffer_minutes)
    INTO is_available;
    
    IF NOT is_available THEN
      RETURN json_build_object('success', false, 'error', 'Time slot not available (including buffer time)');
    END IF;
    
    -- Create reservation
    INSERT INTO reservations (user_id, table_id, reservation_date, start_time, end_time, party_size, notes, status)
    VALUES (p_user_id, p_table_id, p_reservation_date, p_start_time, p_end_time, p_party_size, p_notes, 'confirmed')
    RETURNING id INTO reservation_id;
    
    -- Return success with reservation details
    SELECT json_build_object(
      'success', true,
      'reservation_id', reservation_id,
      'table_id', p_table_id,
      'reservation_date', p_reservation_date,
      'start_time', p_start_time,
      'end_time', p_end_time
    ) INTO result;
    
    RETURN result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RETURN json_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- Function to update reservation with conflict checking
CREATE OR REPLACE FUNCTION update_reservation_safe(
  p_reservation_id INTEGER,
  p_user_id UUID,
  p_table_id INTEGER DEFAULT NULL,
  p_reservation_date DATE DEFAULT NULL,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_party_size INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_buffer_minutes INTEGER DEFAULT 15
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_reservation RECORD;
  new_table_id INTEGER;
  new_date DATE;
  new_start TIME;
  new_end TIME;
  is_available BOOLEAN;
  result JSON;
BEGIN
  -- Start transaction
  BEGIN
    -- Get existing reservation
    SELECT * INTO existing_reservation
    FROM reservations
    WHERE id = p_reservation_id AND user_id = p_user_id;
    
    IF existing_reservation IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Reservation not found or not authorized');
    END IF;
    
    -- Use new values or existing ones
    new_table_id := COALESCE(p_table_id, existing_reservation.table_id);
    new_date := COALESCE(p_reservation_date, existing_reservation.reservation_date);
    new_start := COALESCE(p_start_time, existing_reservation.start_time);
    new_end := COALESCE(p_end_time, existing_reservation.end_time);
    
    -- If table, date, or time changed, check availability
    IF (p_table_id IS NOT NULL OR p_reservation_date IS NOT NULL OR p_start_time IS NOT NULL OR p_end_time IS NOT NULL) THEN
      -- Check availability excluding current reservation
      SELECT check_table_availability_with_buffer(new_table_id, new_date, new_start, new_end, p_buffer_minutes)
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.id != p_reservation_id
          AND r.table_id = new_table_id
          AND r.reservation_date = new_date
          AND r.status IN ('confirmed', 'pending')
          AND (
            (new_start < r.end_time + INTERVAL '1 minute' * p_buffer_minutes)
            AND (new_end + INTERVAL '1 minute' * p_buffer_minutes > r.start_time)
          )
      ) INTO is_available;
      
      IF NOT is_available THEN
        RETURN json_build_object('success', false, 'error', 'Updated time slot not available');
      END IF;
    END IF;
    
    -- Update reservation
    UPDATE reservations
    SET 
      table_id = new_table_id,
      reservation_date = new_date,
      start_time = new_start,
      end_time = new_end,
      party_size = COALESCE(p_party_size, party_size),
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- Return success
    SELECT json_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'message', 'Reservation updated successfully'
    ) INTO result;
    
    RETURN result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RETURN json_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$; 