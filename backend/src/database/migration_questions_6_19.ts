import pool from './db';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Question Migration...');

        // Find the Manufacturing Process Audit template
        const templateRes = await client.query(`
      SELECT template_id FROM audit_templates 
      WHERE template_name = 'Manufacturing Process Audit' 
      LIMIT 1
    `);

        if (templateRes.rows.length === 0) {
            console.error('❌ Template NOT FOUND');
            return;
        }
        const templateId = templateRes.rows[0].template_id;

        const newSections = [
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

        for (const section of newSections) {
            // Check if section already exists
            const existingSec = await client.query(`
        SELECT section_id FROM template_sections 
        WHERE template_id = $1 AND section_name = $2
      `, [templateId, section.name]);

            let sectionId;
            if (existingSec.rows.length === 0) {
                const secRes = await client.query(`
          INSERT INTO template_sections (template_id, section_name, section_order)
          VALUES ($1, $2, $3) RETURNING section_id
        `, [templateId, section.name, section.order]);
                sectionId = secRes.rows[0].section_id;
                console.log(`✓ Created section: ${section.name}`);
            } else {
                sectionId = existingSec.rows[0].section_id;
                console.log(`- Section exists: ${section.name}`);
            }

            let qOrder = 1;
            for (const qText of section.questions) {
                // Check if question already exists in this section
                const existingQ = await client.query(`
          SELECT question_id FROM template_questions 
          WHERE section_id = $1 AND question_text = $2
        `, [sectionId, qText]);

                if (existingQ.rows.length === 0) {
                    await client.query(`
            INSERT INTO template_questions (section_id, question_text, input_type, question_order)
            VALUES ($1, $2, 'standard', $3)
          `, [sectionId, qText, qOrder++]);
                    console.log(`  + Added question: ${qText.substring(0, 50)}...`);
                } else {
                    console.log(`  . Question exists: ${qText.substring(0, 30)}...`);
                    qOrder++;
                }
            }
        }

        console.log('✅ MIGRATION COMPLETE!');
    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
