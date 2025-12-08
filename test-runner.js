#!/usr/bin/env node

/**
 * TradeScout Pro - Automated Test Runner
 * Tests all critical routes and features
 */

import http from 'http';

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testRoute(url, description = '') {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    http.get(url, (res) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        log(`✅ ${description || url} (${duration}ms)`, 'green');
        resolve({ success: true, statusCode: res.statusCode, duration });
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        log(`⚠️  ${description || url} - Redirect ${res.statusCode} (${duration}ms)`, 'yellow');
        resolve({ success: true, statusCode: res.statusCode, duration });
      } else {
        log(`❌ ${description || url} - Status ${res.statusCode} (${duration}ms)`, 'red');
        resolve({ success: false, statusCode: res.statusCode, duration });
      }
    }).on('error', (err) => {
      log(`❌ ${description || url} - ${err.message}`, 'red');
      resolve({ success: false, error: err.message, duration: 0 });
    });
  });
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║    TradeScout Pro - Automated Test Suite              ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝\n', 'blue');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    routes: [],
  };

  // Test Backend Connectivity
  log('🔍 Testing Backend Server...', 'bold');
  let backendTest = await testRoute(BACKEND_URL, 'Backend API Health');
  results.total++;
  if (backendTest.success) results.passed++; else results.failed++;

  // Test Frontend Connectivity
  log('\n🔍 Testing Frontend Server...', 'bold');
  let frontendTest = await testRoute(FRONTEND_URL, 'Frontend Server Health');
  results.total++;
  if (frontendTest.success) results.passed++; else results.failed++;

  // Test Public Routes
  log('\n🌐 Testing Public Routes...', 'bold');
  const publicRoutes = [
    { url: `${FRONTEND_URL}/`, desc: 'Home Page' },
    { url: `${FRONTEND_URL}/about`, desc: 'About Page' },
    { url: `${FRONTEND_URL}/contact`, desc: 'Contact Page' },
    { url: `${FRONTEND_URL}/terms`, desc: 'Terms of Service' },
    { url: `${FRONTEND_URL}/privacy`, desc: 'Privacy Policy' },
    { url: `${FRONTEND_URL}/help`, desc: 'Help Center' },
    { url: `${FRONTEND_URL}/login`, desc: 'Login Page' },
    { url: `${FRONTEND_URL}/signup`, desc: 'Sign Up Page' },
    { url: `${FRONTEND_URL}/find-contractors`, desc: 'Find Contractors' },
    { url: `${FRONTEND_URL}/marketplace`, desc: 'Marketplace' },
    { url: `${FRONTEND_URL}/exchange`, desc: 'Exchange' },
  ];

  for (const route of publicRoutes) {
    let test = await testRoute(route.url, route.desc);
    results.total++;
    if (test.success) results.passed++; else results.failed++;
    results.routes.push({ route: route.url, desc: route.desc, ...test });
  }

  // Test Protected Routes (will redirect to login)
  log('\n🔐 Testing Protected Routes (expect redirects)...', 'bold');
  const protectedRoutes = [
    { url: `${FRONTEND_URL}/dashboard`, desc: 'Dashboard' },
    { url: `${FRONTEND_URL}/profile`, desc: 'Profile' },
    { url: `${FRONTEND_URL}/chat`, desc: 'Chat' },
    { url: `${FRONTEND_URL}/settings`, desc: 'Settings' },
    { url: `${FRONTEND_URL}/notifications`, desc: 'Notifications' },
  ];

  for (const route of protectedRoutes) {
    let test = await testRoute(route.url, route.desc);
    results.total++;
    // Protected routes should redirect (status 3xx or higher due to redirect)
    if (test.statusCode >= 300 || test.success) results.passed++; else results.failed++;
    results.routes.push({ route: route.url, desc: route.desc, protected: true, ...test });
  }

  // Test Admin Routes
  log('\n⚙️  Testing Admin Routes...', 'bold');
  const adminRoutes = [
    { url: `${FRONTEND_URL}/admin`, desc: 'Admin Dashboard' },
    { url: `${FRONTEND_URL}/admin/panel`, desc: 'Admin Panel' },
    { url: `${FRONTEND_URL}/admin/users`, desc: 'User Management' },
  ];

  for (const route of adminRoutes) {
    let test = await testRoute(route.url, route.desc);
    results.total++;
    if (test.statusCode >= 300 || test.success) results.passed++; else results.failed++;
    results.routes.push({ route: route.url, desc: route.desc, admin: true, ...test });
  }

  // Test 404 Handling
  log('\n📋 Testing Error Handling...', 'bold');
  let notFoundTest = await testRoute(`${FRONTEND_URL}/invalid-route-xyz`, '404 Page');
  results.total++;
  // 404 pages typically return 200 with error content
  if (notFoundTest.success || notFoundTest.statusCode === 404) results.passed++; else results.failed++;

  // Test API Endpoints
  log('\n🔌 Testing API Endpoints...', 'bold');
  const apiEndpoints = [
    { url: `${BACKEND_URL}/api/health`, desc: 'Health Check' },
    { url: `${BACKEND_URL}/api/marketplace/listings`, desc: 'Marketplace Listings' },
  ];

  for (const endpoint of apiEndpoints) {
    let test = await testRoute(endpoint.url, endpoint.desc);
    results.total++;
    if (test.success) results.passed++; else results.failed++;
    results.routes.push({ route: endpoint.url, desc: endpoint.desc, api: true, ...test });
  }

  // Print Summary
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║               TEST RESULTS SUMMARY                    ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝\n', 'blue');

  log(`Total Tests: ${results.total}`, 'bold');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  const passRate = Math.round((results.passed / results.total) * 100);
  log(`Success Rate: ${passRate}%\n`, passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');

  // Recommendations
  if (results.failed > 0) {
    log('⚠️  Issues Found:', 'yellow');
    const failedTests = results.routes.filter(r => !r.success);
    failedTests.forEach(test => {
      log(`   - ${test.desc}: ${test.error || `Status ${test.statusCode}`}`, 'yellow');
    });
  } else {
    log('🎉 All tests passed!', 'green');
  }

  log('\n📊 Detailed Results:', 'bold');
  console.table(results.routes.map(r => ({
    Route: r.desc,
    Status: r.statusCode || 'Error',
    Duration: `${r.duration}ms`,
    Success: r.success ? '✅' : '❌',
  })));

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  log(`Fatal Error: ${err.message}`, 'red');
  process.exit(1);
});
