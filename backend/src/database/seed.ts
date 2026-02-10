import pool from './db';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Database Seed...');

    // 1. CLEANUP (Clear old data to avoid duplicates)
    await client.query('TRUNCATE users, audit_templates, template_sections, template_questions, audits, audit_checklist_answers, audit_objectives_log, audit_calibration_log, audit_parameter_log, non_conformances, audit_logs CASCADE');

    // ============================================================================
    // 2. CREATE USERS (The 4 Roles)
    // ============================================================================
    const passwordHash = await bcrypt.hash('123456', 10);

    const usersQuery = `
      INSERT INTO users (full_name, email, password_hash, role) VALUES
      ($1, $2, $3, 'Admin'),      -- Kripa Biju
      ($4, $5, $6, 'L1_Auditor'),  -- Nayan Sagitra
      ($7, $8, $9, 'Admin'),      -- Vismay Chand
      ($10, $11, $12, 'L2_Auditor'), -- Debakanta Padhi
      ($13, $14, $15, 'Process_Owner'), -- Vishal Varma
      ($16, $17, $18, 'Process_Owner'), -- Venkatnarayana Boya
      ($19, $20, $21, 'Process_Owner'), -- Debaraj Bairagi
      ($22, $23, $24, 'Process_Owner')  -- Sachin Achari
      RETURNING user_id, role, email;
    `;

    const userRes = await client.query(usersQuery, [
      'Kripa Biju', 'kripa.biju@dana.com', passwordHash,
      'Nayan Sagitra', 'nayan.sagitra@dana.com', passwordHash,
      'Vismay Chand', 'vismay.chand@dana.com', passwordHash,
      'Debakanta Padhi', 'debakanta.padhi@dana.com', passwordHash,
      'Vishal Varma', 'vishal.varma@dana.com', passwordHash,
      'Venkatnarayana Boya', 'venkatnarayana.boya@dana.com', passwordHash,
      'Debaraj Bairagi', 'debaraj.bairagi@dana.com', passwordHash,
      'Sachin Achari', 'sachin.achari@dana.com', passwordHash
    ]);

    const adminId = userRes.rows.find((u: any) => u.email === 'vismay.chand@dana.com').user_id;
    const l1Id = userRes.rows.find((u: any) => u.email === 'nayan.sagitra@dana.com').user_id;
    const l2Id = userRes.rows.find((u: any) => u.email === 'debakanta.padhi@dana.com').user_id;
    const ownerId = userRes.rows.find((u: any) => u.email === 'vishal.varma@dana.com').user_id;

    console.log('✓ Users created');

    // ============================================================================
    // 3. CREATE TEMPLATE
    // ============================================================================

    const templateRes = await client.query(`
      INSERT INTO audit_templates (template_name, description, created_by)
      VALUES ('Manufacturing Process Audit', 'QF/MR/19 - Standard Audit Sheet', $1)
      RETURNING template_id
    `, [adminId]);
    const templateId = templateRes.rows[0].template_id;

    console.log('✓ Template created');

    // ============================================================================
    // 4. CREATE SECTIONS & QUESTIONS
    // ============================================================================

    const sectionsData = [
      {
        name: '1. Shift Start',
        order: 1,
        questions: [
          'Is Set up / First Piece report Available with Reading?',
          'Are the autonomous maintenance check sheet followed (Prod AM Check Sheet)?'
        ]
      },
      {
        name: '2. Safety',
        order: 2,
        questions: [
          'Are the safety points followed? (shoes, goggle, apron etc)',
          'Free of any abnormalities during operation (Clamping issues, Door closing issue)?'
        ]
      },
      {
        name: '3. Operational Instructions',
        order: 3,
        questions: [
          'Availability of set up procedure & are the same followed?',
          'Availability of SWCT & are the same followed?',
          'Part traceability is OK? Identification Tagging, status?',
          'Are the reaction plans followed & NC Handling as per System?'
        ]
      },
      {
        name: '4. Process Control Plan / PFMEA',
        order: 4,
        questions: [
          'Linkage of PFMEA with Control Plans?',
          'Effectiveness of Process Control Plan / PFMEA/SOPs?',
          'Revision Linkage between Control Plans & Engg. Drawing?'
        ]
      },
      {
        name: '5. Gauges',
        order: 5,
        questions: [
          'All the Gauges are available on machine?',
          'All the gauges are calibrated & have record?',
          'Condition of Gauges OK or Not OK? Cleanliness, free of damages'
        ]
      },
      {
        name: '6. Personnel & Process Awareness',
        order: 6,
        questions: [
          'Is the Employees aware of Customer Specific Requirements (Defect - Effect matrix, Component fitment, component for which customer, etc)',
          'Are the Employees suitable to perform the required tasks and is their Training record Maintained?',
          'Can the Quality Requirements be monitored Effectively during regular Production with the defined Inspection Measuring and test Equipments?',
          'Are the Work and Inspection Stations appropriate to the needs? (check appropriate aspects such as Ergonomics, Lighting, Ventilation, etc)',
          'Are the relevant details in the Control Plan, PFMEA and SOP for respective process maintained?'
        ]
      },
      {
        name: '7. Material & Tool Control',
        order: 7,
        questions: [
          'Are Rejects, Rework and Setup parts strictly separated and identified?',
          'Is the Material and Parts flow secured against mix-ups and whether Traceability is ensured?',
          'Are tools, equipments and inspection Measuring and Test Equipments stored correctly?'
        ]
      },
      {
        name: '8. Data & Improvement',
        order: 8,
        questions: [
          'Are the Quality and Process data statistically analyzed and are improvement programs derived from this?',
          'Are the causes of Product and Process Nonconformities analyzed and the Corrective actions, including short-term actions checked for their Efectiveness?'
        ]
      },
      {
        name: '9. Production & Maintenance',
        order: 9,
        questions: [
          'Whether the production is carried out as per the defined set-up and cycle time?',
          'Whether the In-process Rejection and Rework data are within the Target levels?',
          'Whether the defined Maintenance checks are carried out as per the Work instructions?',
          'Whether shift start and shift handover data is maintained or not?'
        ]
      }
    ];

    for (const section of sectionsData) {
      const secRes = await client.query(`
        INSERT INTO template_sections (template_id, section_name, section_order)
        VALUES ($1, $2, $3) RETURNING section_id
      `, [templateId, section.name, section.order]);

      const sectionId = secRes.rows[0].section_id;

      let qOrder = 1;
      for (const qText of section.questions) {
        await client.query(`
          INSERT INTO template_questions (section_id, question_text, input_type, question_order)
          VALUES ($1, $2, 'standard', $3)
        `, [sectionId, qText, qOrder++]);
      }
    }
    console.log('✓ Sections & Questions populated for Manufacturing Audit');

    // ============================================================================
    // 4B. CREATE DOCK AUDIT TEMPLATE
    // ============================================================================

    const dockTemplateRes = await client.query(`
      INSERT INTO audit_templates (template_name, description, created_by)
      VALUES ('Dock Audit', 'QF/QA/134 - Dock Audit Report', $1)
      RETURNING template_id
    `, [adminId]);
    const dockTemplateId = dockTemplateRes.rows[0].template_id;

    const dockSections = [
      {
        name: 'a) DIMENSIONAL',
        order: 1,
        questions: [
          'Box number',
          'Box packing Quantity',
          'Packed By',
          'Lot Qty',
          'Observations',
          'Box condition'
        ]
      },
      {
        name: 'b) PACKING, LABELING & PRESERVATION',
        order: 2,
        questions: [
          'Packaging standards available',
          'Oiling all over',
          'No Loose Packing'
        ]
      },
      {
        name: 'c) RELEVANT DOCUMENTS',
        order: 3,
        questions: [
          'Conformity Certificate (incase of Export)',
          'DFIR Availability and required Data',
          'Dimensional Verification as per DFIR (SC/CC/CAP)',
          'Tag availability and required data'
        ]
      },
      {
        name: 'd) Product Audit',
        order: 4,
        questions: [
          'Operation 1',
          'Operation 2',
          'Operation 3',
          'Operation 4',
          'Operation 5'
        ]
      }
    ];

    for (const section of dockSections) {
      const secRes = await client.query(`
        INSERT INTO template_sections (template_id, section_name, section_order)
        VALUES ($1, $2, $3) RETURNING section_id
      `, [dockTemplateId, section.name, section.order]);

      const sectionId = secRes.rows[0].section_id;

      let qOrder = 1;
      for (const qText of section.questions) {
        await client.query(`
          INSERT INTO template_questions (section_id, question_text, input_type, question_order)
          VALUES ($1, $2, 'dock_audit', $3)
        `, [sectionId, qText, qOrder++]);
      }
    }
    console.log('✓ Sections & Questions populated for Dock Audit');



    console.log('✅ SEEDING COMPLETE!');
    console.log('------------------------------------------------');
    console.log('Login Details (Password: 123456 for all):');
    console.log('Admin: vismay.chand@dana.com');
    console.log('Admin: kripa.biju@dana.com');
    console.log('------------------------------------------------');

  } catch (err) {
    console.error('❌ Seed Failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function seedDatabase() {
  try {
    await seed();
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
}

// Run seeding if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().then(() => {
    console.log('Done');
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}