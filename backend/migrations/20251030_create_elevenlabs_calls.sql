-- Migration: Create ElevenLabs calls tracking tables
-- Created: 2025-10-30
-- Purpose: Store and sync ElevenLabs conversation data locally

-- Table for storing ElevenLabs conversations/calls
CREATE TABLE IF NOT EXISTS elevenlabs_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    call_id VARCHAR(100),
    agent_id VARCHAR(100),
    caller_number VARCHAR(50),
    callee_number VARCHAR(50),
    
    -- Call status and metadata
    status ENUM('done', 'in_progress', 'failed', 'waiting') DEFAULT 'waiting',
    call_direction ENUM('inbound', 'outbound') DEFAULT 'inbound',
    call_type VARCHAR(50),
    
    -- Timestamps
    started_at DATETIME,
    ended_at DATETIME,
    duration_seconds INT DEFAULT 0,
    
    -- Conversation content (JSON storage)
    transcript LONGTEXT,
    analysis JSON,
    summary TEXT,
    metadata JSON,
    
    -- Technical details
    end_reason VARCHAR(100),
    recording_url VARCHAR(500),
    
    -- Sync control
    synced_from_api BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at DESC),
    INDEX idx_caller_number (caller_number),
    INDEX idx_agent_id (agent_id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for tracking sync status and errors
CREATE TABLE IF NOT EXISTS elevenlabs_sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_type ENUM('webhook', 'polling', 'manual') NOT NULL,
    records_synced INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP NULL,
    status ENUM('success', 'failed', 'in_progress') DEFAULT 'in_progress',
    
    INDEX idx_sync_started (sync_started_at DESC),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial sync log entry
INSERT INTO elevenlabs_sync_log (sync_type, status, records_synced) 
VALUES ('manual', 'success', 0);
