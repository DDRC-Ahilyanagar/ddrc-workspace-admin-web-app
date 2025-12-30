-- =====================================================
-- SQL Script to Truncate Survey Tables for Fresh Start
-- =====================================================
-- WARNING: This will DELETE ALL survey data!
-- Make sure you have a backup before running this.
-- =====================================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- SURVEY DATA TABLES (Truncate these)
-- =====================================================

-- Main survey data table
TRUNCATE TABLE surveys;

-- Survey uploaded files (Aadhaar cards, certificates, etc.)
TRUNCATE TABLE survey_files;

-- Survey Aadhaar entries
TRUNCATE TABLE survey_aadhar;

-- Legacy Aadhaar table (if exists)
-- TRUNCATE TABLE aadhaars;

-- OTP verification logs (optional - can keep for audit)
-- TRUNCATE TABLE otp_verifications;

-- =====================================================
-- DO NOT TRUNCATE THESE TABLES (Master/Reference Data)
-- =====================================================
-- tbl_all_grams - Gram panchayat lookup data
-- tbl_all_phc - PHC lookup data
-- tbl_all_talathi - Talathi lookup data
-- tbl_all_villages - Villages lookup data
-- tbl_taluka - Taluka lookup data
-- users - User accounts
-- user_types - User role types
-- questions - Survey questions
-- sections - Survey sections
-- =====================================================

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Verification Queries (Run these to verify truncation)
-- =====================================================
-- SELECT COUNT(*) as survey_count FROM surveys;
-- SELECT COUNT(*) as file_count FROM survey_files;
-- SELECT COUNT(*) as aadhaar_count FROM survey_aadhar;
-- =====================================================
