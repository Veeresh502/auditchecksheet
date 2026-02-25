const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
// Using a mock token that bypasses auth for this test or getting a valid one if possible
// However, I'll just check if the code logic works.

async function verifyUpsert() {
    const audit_id = 'c1b52a65-1823-455a-939e-953e5e54d852'; // Example ID

    console.log('--- Verifying Objectives Atomic Upsert ---');
    const payload = {
        audit_id,
        objective_type: 'quality',
        parameter_name: 'TEST_PARAMETER',
        target_value: '100',
        actual_value: '95'
    };

    try {
        // Send two requests almost simultaneously
        const req1 = axios.post(`${API_URL}/answers/objectives`, payload, {
            headers: { Authorization: `Bearer TEST_TOKEN` }
        });
        const req2 = axios.post(`${API_URL}/answers/objectives`, { ...payload, actual_value: '98' }, {
            headers: { Authorization: `Bearer TEST_TOKEN` }
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        console.log('Req 1 Response:', res1.data);
        console.log('Req 2 Response:', res2.data);
        console.log('✅ Atomic Upsert Verified (no constraint violations)');
    } catch (err) {
        if (err.response?.data?.error?.includes('unique_audit_objective')) {
            console.error('❌ Failed: Unique constraint violation detected!');
        } else {
            console.error('Test Result (expected fail if no token):', err.response?.data || err.message);
        }
    }
}

// verifyUpsert();
