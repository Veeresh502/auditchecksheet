import pool from './db';
import { fileURLToPath } from 'url';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting database migrations...');

    // Create extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✓ Extensions enabled');

    // ============================================================================
    // 1. IDENTITY & ACCESS MANAGEMENT (The "Who")
    // ============================================================================

    try {
      await client.query(`
        CREATE TYPE role_enum AS ENUM ('Admin', 'L1_Auditor', 'L2_Auditor', 'Process_Owner');
      `);
    } catch (err: any) {
      if (err.code !== '42710') throw err; // 42710 = type already exists
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role role_enum NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Users table created (IAM)');

    // ============================================================================
    // 2. THE BLUEPRINT (The "Static" Structure)
    // ============================================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_templates (
        template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by UUID NOT NULL REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Audit_Templates table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS template_sections (
        section_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id UUID NOT NULL REFERENCES audit_templates(template_id) ON DELETE CASCADE,
        section_name VARCHAR(255) NOT NULL,
        section_order INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Template_Sections table created');

    try {
      await client.query(`
        CREATE TYPE input_type_enum AS ENUM ('standard', 'calibration_row', 'shift_reading', 'dock_audit');
      `);
    } catch (err: any) {
      if (err.code !== '42710') throw err;
    }

    // Add 'dock_audit' to existing enum if it doesn't exist
    try {
      await client.query(`
        ALTER TYPE input_type_enum ADD VALUE IF NOT EXISTS 'dock_audit';
      `);
    } catch (err: any) {
      // Ignore if value already exists
      console.log('dock_audit enum value may already exist');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS template_questions (
        question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        section_id UUID NOT NULL REFERENCES template_sections(section_id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        input_type input_type_enum NOT NULL DEFAULT 'standard',
        question_order INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Template_Questions table created');

    // ============================================================================
    // 3. THE AUDIT INSTANCE (The "Event")
    // ============================================================================

    try {
      await client.query(`
        CREATE TYPE audit_status_enum AS ENUM (
          'Assigned',
          'In_Progress',
          'NC_Open',
          'NC_Pending_Verify',
          'Submitted_to_L2',
          'Completed',
          'Rejected'
        );
      `);
    } catch (err: any) {
      if (err.code !== '42710') throw err;
    }

    // Add 'Rejected' to existing enum if it doesn't exist
    try {
      await client.query(`ALTER TYPE audit_status_enum ADD VALUE IF NOT EXISTS 'Rejected';`);
    } catch (err) {
      console.log('Rejected enum value check skipped');
    }

    try {
      await client.query(`ALTER TYPE audit_status_enum ADD VALUE IF NOT EXISTS 'In_Progress' BEFORE 'NC_Open';`);
      console.log('✓ Added In_Progress to audit_status_enum');
    } catch (err) {
      console.log('In_Progress enum value check skipped or already exists');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS audits (
        audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id UUID NOT NULL REFERENCES audit_templates(template_id),
        machine_name VARCHAR(255) NOT NULL,
        audit_date DATE NOT NULL,
        shift CHAR(1) CHECK (shift IN ('A', 'B', 'C')),
        l1_auditor_id UUID NOT NULL REFERENCES users(user_id),
        l2_auditor_id UUID REFERENCES users(user_id),
        process_owner_id UUID REFERENCES users(user_id),
        status audit_status_enum NOT NULL DEFAULT 'Assigned',
        submitted_at TIMESTAMP,
        operation VARCHAR(255),
        part_name VARCHAR(255),
        part_number VARCHAR(255),
        series VARCHAR(255),    -- <--- NEW
        invoice_no VARCHAR(255), -- <--- NEW
        doc_no VARCHAR(255), -- <--- NEW
        qty_audited VARCHAR(255), -- <--- NEW
        process VARCHAR(255), -- <--- NEW: Process Dropdown value
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add submitted_at column if it doesn't exist (for existing tables)
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS operation VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS part_name VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS part_number VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS series VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS doc_no VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS qty_audited VARCHAR(255);`);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS process VARCHAR(255);`);
    console.log('✓ Audits table created');

    // ============================================================================
    // 4. DATA CAPTURE (The 4 Distinct Tabs)
    // ============================================================================

    // 4A. Standard Checklist (Pages 1-3)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_checklist_answers(
      answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES template_questions(question_id),
      l1_observation TEXT,
      l1_value VARCHAR(255), -- <--- NEW: For "Audit done on" or generic input
      file_url VARCHAR(500),
      l2_score INT CHECK(l2_score IN(0, 1, 2, 3)), -- 0=NC, 1=Observation/Partial, 2=OK, 3=NA
      l2_remarks TEXT,
      answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      scored_at TIMESTAMP
    );
    `);

    // Ensure column exists for existing DBs
    await client.query(`ALTER TABLE audit_checklist_answers ADD COLUMN IF NOT EXISTS l1_value VARCHAR(255);`);

    // UPDATE CONSTRAINT for existing tables to allow 3
    try {
      await client.query(`
            ALTER TABLE audit_checklist_answers DROP CONSTRAINT IF EXISTS audit_checklist_answers_l2_score_check;
            ALTER TABLE audit_checklist_answers ADD CONSTRAINT audit_checklist_answers_l2_score_check CHECK (l2_score IN (0, 1, 2, 3));
        `);
      console.log('✓ Updated l2_score constraint to include 3 (NA)');
    } catch (error) {
      console.error('Error updating constraint:', error);
    }

    console.log('✓ Audit_Checklist_Answers table created (Tab 1)');

    // 4B. Machine Objectives (Page 4)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_objectives_log(
      objective_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      objective_type VARCHAR(50) DEFAULT 'product_characteristic', -- product_characteristic, productivity, maintenance, quality
      parameter_name VARCHAR(255) NOT NULL,
      sample_size VARCHAR(100),
      target_value VARCHAR(100), -- Used for Product Characteristics, Productivity, Quality
      actual_value VARCHAR(100), -- Used for Product Characteristics, Productivity, Quality
      tool_target VARCHAR(100), -- Used for Maintenance
      tool_actual VARCHAR(100), -- Used for Maintenance
      machine_target VARCHAR(100), -- Used for Maintenance
      machine_actual VARCHAR(100), -- Used for Maintenance
      remarks TEXT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    // Ensure columns exist for existing DBs
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS objective_type VARCHAR(50) DEFAULT 'product_characteristic';`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS sample_size VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS tool_target VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS tool_actual VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS machine_target VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS machine_actual VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_objectives_log ADD COLUMN IF NOT EXISTS remarks TEXT; `);
    await client.query(`ALTER TABLE audit_objectives_log ALTER COLUMN target_value DROP NOT NULL;`);
    await client.query(`ALTER TABLE audit_objectives_log ALTER COLUMN actual_value DROP NOT NULL;`);
    await client.query(`ALTER TABLE audit_objectives_log DROP CONSTRAINT IF EXISTS unique_audit_objective;`);
    await client.query(`ALTER TABLE audit_objectives_log ADD CONSTRAINT unique_audit_objective UNIQUE (audit_id, objective_type, parameter_name);`);
    console.log('✓ Audit_Objectives_Log table updated (Tab 2)');

    // 4C. Calibration Log (Page 5)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_calibration_log(
      calibration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      instrument_name VARCHAR(255) NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR(50) NOT NULL CHECK(status IN('OK', 'Expired')),
      grr_details VARCHAR(255), -- < --- NEW
        remarks TEXT, -- < --- NEW
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    await client.query(`ALTER TABLE audit_calibration_log ADD COLUMN IF NOT EXISTS grr_details VARCHAR(255); `);
    await client.query(`ALTER TABLE audit_calibration_log ADD COLUMN IF NOT EXISTS remarks TEXT; `);
    await client.query(`ALTER TABLE audit_calibration_log DROP CONSTRAINT IF EXISTS unique_audit_calibration;`);
    await client.query(`ALTER TABLE audit_calibration_log ADD CONSTRAINT unique_audit_calibration UNIQUE (audit_id, instrument_name);`);
    console.log('✓ Audit_Calibration_Log table created (Tab 3)');

    // 4D. Process Parameters (Shift Data - Page 5)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_parameter_log(
      parameter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      parameter_name VARCHAR(255) NOT NULL,
      spec_limit VARCHAR(100),
      shift_a_value VARCHAR(100),
      shift_b_value VARCHAR(100),
      shift_c_value VARCHAR(100),
      remarks TEXT, -- < --- NEW
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    await client.query(`ALTER TABLE audit_parameter_log ADD COLUMN IF NOT EXISTS remarks TEXT; `);
    await client.query(`ALTER TABLE audit_parameter_log DROP CONSTRAINT IF EXISTS unique_audit_parameter;`);
    await client.query(`ALTER TABLE audit_parameter_log ADD CONSTRAINT unique_audit_parameter UNIQUE (audit_id, parameter_name);`);
    console.log('✓ Audit_Parameter_Log table created (Tab 4)');

    // Add Signature Columns to Audits
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS l1_signature_url VARCHAR(500); `);
    await client.query(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS l2_signature_url VARCHAR(500); `);

    // ============================================================================
    // 5. THE "NC LOOP" (The Process Owner Workflow)
    // ============================================================================

    try {
      await client.query(`
        CREATE TYPE nc_status_enum AS ENUM('Open', 'Pending_Verification', 'Closed');
    `);
    } catch (err: any) {
      if (err.code !== '42710') throw err;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS non_conformances(
      nc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      question_id VARCHAR(255),
      issue_description TEXT NOT NULL,
      nc_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      root_cause TEXT,
      corrective_action TEXT,
      evidence_url VARCHAR(500),
      status nc_status_enum NOT NULL DEFAULT 'Open',
      l1_verifier_id UUID REFERENCES users(user_id),
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      risk_level VARCHAR(50) DEFAULT 'Low' -- <--- NEW
    );
    `);

    await client.query(`ALTER TABLE non_conformances ADD COLUMN IF NOT EXISTS issue_image_url VARCHAR(500);`);

    // --- FIX FOR NC RAISING ISSUE ---
    try {
      await client.query(`
        ALTER TABLE non_conformances DROP CONSTRAINT IF EXISTS non_conformances_question_id_fkey;
        ALTER TABLE non_conformances ALTER COLUMN question_id TYPE VARCHAR(255);
      `);
      console.log('✓ Relaxed non_conformances.question_id constraints');
    } catch (e) {
      console.log('NC constraint relaxation already applied or failed safely');
    }

    console.log('✓ Non_Conformances table created (NC Loop)');

    // ============================================================================
    // AUDIT LOG FOR ACCOUNTABILITY
    // ============================================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs(
      log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      audit_id UUID NOT NULL REFERENCES audits(audit_id) ON DELETE CASCADE,
      action VARCHAR(255) NOT NULL,
      actor_id UUID NOT NULL REFERENCES users(user_id),
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    console.log('✓ Audit_Logs table created');

    // ============================================================================
    // DOCK Audit Report Products
    // ============================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS dock_products(
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initial Seed for Products (Clear old ones first to avoid mixing)
    await client.query(`TRUNCATE dock_products CASCADE;`);
    const products = [
      'HINO CF', 'FREY', 'TUBE SHAFT & MSTS', 'GERMAN TY', 'UJ & BC', 'SY',
      'MERCEDES FY', 'SERRATED FY', 'TUNDRA FY', 'TUNDRA SY',
      'YOKE SLEEVE', 'TY/FY', 'YOKE SHAFT', 'END YOKE (LDEY)',
      'SLEEVE MUFF', 'DIFF CASE', 'END YOKE (HDEY)'
    ];

    for (const prod of products) {
      await client.query(`INSERT INTO dock_products (product_name) VALUES ($1) ON CONFLICT (product_name) DO NOTHING`, [prod]);
    }

    console.log('✓ Dock Products table created and seeded');

    // DOCK Audit Report Plan
    // ============================================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS dock_audit_plan(
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      part_family VARCHAR(100), --e.g. "Tube Shaft"
        month VARCHAR(20), --e.g. "Jan"
      week_1_plan BOOLEAN DEFAULT false,
      week_1_audit_id UUID REFERENCES audits(audit_id),
      week_2_plan BOOLEAN DEFAULT false,
      week_2_audit_id UUID REFERENCES audits(audit_id),
      week_3_plan BOOLEAN DEFAULT false,
      week_3_audit_id UUID REFERENCES audits(audit_id),
      week_4_plan BOOLEAN DEFAULT false,
      week_4_audit_id UUID REFERENCES audits(audit_id),
      planned_day INT DEFAULT 26,
      year INT DEFAULT 2025
    );
    `);

    // Add columns if table already exists (for safety)
    try {
      await client.query(`ALTER TABLE dock_audit_plan ADD COLUMN IF NOT EXISTS week_1_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE dock_audit_plan ADD COLUMN IF NOT EXISTS week_2_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE dock_audit_plan ADD COLUMN IF NOT EXISTS week_3_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE dock_audit_plan ADD COLUMN IF NOT EXISTS week_4_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE dock_audit_plan ADD COLUMN IF NOT EXISTS planned_day INT DEFAULT 26;`);
    } catch (e) { console.log('Columns already exist or error adding them to dock_audit_plan') }

    console.log('✓ Dock Audit Plan table created');

    // ============================================================================
    // MANUFACTURING Product Audit Plan
    // ============================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS mfg_products(
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initial Seed for Mfg Products (Standardized to match Manufacturing Image)
    await client.query(`TRUNCATE mfg_products CASCADE;`);
    const mfgProducts = [
      'Serrated FY', 'MSTS', 'Tube Yoke', 'Tube Shaft', 'UJ Cross',
      'Bearing Cup Assly', 'Slip Yoke', 'HDEY', 'Toyota FREY',
      'MERCEDES Flange yoke', 'TUNDRA FY', 'Compact TY', 'COMPACT FY',
      'SLEEVE MUFF', 'YS ASSEMBLY', 'NISSAN CF / HINO CF', 'JAGUAR',
      'Diff-Case', 'COMPANION FLANGE', 'Yoke shaft', 'KIT ASSEMBLY',
      'MERCEDES FY', 'LDEY', 'YOKE SLEEVE', 'Argentina TY / Mercedes TY'
    ];

    for (const prod of mfgProducts) {
      await client.query(`INSERT INTO mfg_products (product_name) VALUES ($1) ON CONFLICT (product_name) DO NOTHING`, [prod]);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS mfg_audit_plan(
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        part_family VARCHAR(100),
        month VARCHAR(20),
        year INT DEFAULT 2026,
        week_1_plan BOOLEAN DEFAULT false,
        week_1_audit_id UUID REFERENCES audits(audit_id),
        week_2_plan BOOLEAN DEFAULT false,
        week_2_audit_id UUID REFERENCES audits(audit_id),
        week_3_plan BOOLEAN DEFAULT false,
        week_3_audit_id UUID REFERENCES audits(audit_id),
        week_4_plan BOOLEAN DEFAULT false,
        week_4_audit_id UUID REFERENCES audits(audit_id)
      );
    `);

    // Ensure columns exist for existing DBs
    try {
      await client.query(`ALTER TABLE mfg_audit_plan ADD COLUMN IF NOT EXISTS week_1_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE mfg_audit_plan ADD COLUMN IF NOT EXISTS week_2_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE mfg_audit_plan ADD COLUMN IF NOT EXISTS week_3_audit_id UUID REFERENCES audits(audit_id);`);
      await client.query(`ALTER TABLE mfg_audit_plan ADD COLUMN IF NOT EXISTS week_4_audit_id UUID REFERENCES audits(audit_id);`);
    } catch (e) {
      console.log('Columns already exist or error adding them to mfg_audit_plan');
    }

    console.log('✓ Manufacturing Audit Plan table created and seeded');

    // ============================================================================
    // INDEXES FOR PERFORMANCE
    // ============================================================================

    await client.query('CREATE INDEX IF NOT EXISTS idx_audits_l1_auditor ON audits(l1_auditor_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audits_l2_auditor ON audits(l2_auditor_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audits_process_owner ON audits(process_owner_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audits_template ON audits(template_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_checklist_answers_audit ON audit_checklist_answers(audit_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ncs_audit ON non_conformances(audit_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ncs_status ON non_conformances(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);');
    console.log('✓ Indexes created');

    console.log('✅ Database migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Migration error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackMigrations() {
  const client = await pool.connect();
  try {
    console.log('Starting database rollback...');

    const tables = [
      "audit_logs",
      "non_conformances",
      "audit_parameter_log",
      "audit_calibration_log",
      "audit_objectives_log",
      "audit_checklist_answers",
      "audits",
      "template_questions",
      "template_sections",
      "audit_templates",
      "users",
      "dock_audit_plan",
      "mfg_products",
      "mfg_audit_plan"
    ];


    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE; `);
      console.log(`✓ Dropped ${table} table`);
    }

    console.log('✅ Database rollback completed');
  } catch (error) {
    console.error('❌ Rollback error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations on module load if this is main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
