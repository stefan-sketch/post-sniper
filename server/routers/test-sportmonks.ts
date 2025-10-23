import { Router } from 'express';

const router = Router();
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

router.get('/test-sportmonks', async (req, res) => {
  if (!API_TOKEN) {
    return res.json({
      error: 'SPORTMONKS_API_TOKEN not set in environment variables'
    });
  }

  const results: any = {};
  const today = new Date().toISOString().split('T')[0];

  // Test different endpoints
  const endpoints = [
    { name: 'livescores', url: `${BASE_URL}/livescores` },
    { name: 'livescores/inplay', url: `${BASE_URL}/livescores/inplay` },
    { name: 'fixtures/date/{date}', url: `${BASE_URL}/fixtures/date/${today}` },
    { name: 'fixtures/between/{start}/{end}', url: `${BASE_URL}/fixtures/between/${today}/${today}` },
    { name: 'leagues', url: `${BASE_URL}/leagues` },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`[Test] Trying endpoint: ${endpoint.name}`);
      const response = await fetch(`${endpoint.url}?api_token=${API_TOKEN}`);
      const data = await response.json();
      
      results[endpoint.name] = {
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        hasData: !!data.data,
        dataCount: Array.isArray(data.data) ? data.data.length : (data.data ? 1 : 0),
        error: data.message || data.error || null,
        sample: data.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : null
      };
      
      console.log(`[Test] ${endpoint.name}: ${response.status} - ${response.ok ? 'SUCCESS' : 'FAILED'}`);
      if (!response.ok) {
        console.log(`[Test] Error: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      results[endpoint.name] = {
        status: 'error',
        error: error.message
      };
      console.log(`[Test] ${endpoint.name}: ERROR - ${error.message}`);
    }
  }

  res.json({
    apiTokenConfigured: !!API_TOKEN,
    apiTokenLength: API_TOKEN?.length,
    testDate: today,
    results
  });
});

export default router;

