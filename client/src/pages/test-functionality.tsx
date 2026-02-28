import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, Database, Server, Wifi } from "lucide-react";

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'loading';
  message: string;
  timing?: number;
}

export default function TestFunctionality() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // API Health Check
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/health'],
    queryFn: async () => {
      const start = Date.now();
      const response = await fetch('/api/health');
      const data = await response.json();
      return { ...data, timing: Date.now() - start };
    }
  });

  // Counties API Test
  const { data: countiesData, isLoading: countiesLoading } = useQuery({
    queryKey: ['/api/counties'],
    queryFn: async () => {
      const start = Date.now();
      const response = await fetch('/api/counties');
      const data = await response.json();
      return { data, timing: Date.now() - start };
    }
  });

  // Trades API Test
  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ['/api/trades'],
    queryFn: async () => {
      const start = Date.now();
      const response = await fetch('/api/trades');
      const data = await response.json();
      return { data, timing: Date.now() - start };
    }
  });

  // Contractors API Test
  const { data: contractorsData, isLoading: contractorsLoading } = useQuery({
    queryKey: ['/api/contractors'],
    queryFn: async () => {
      const start = Date.now();
      const response = await fetch('/api/contractors?limit=10');
      const data = await response.json();
      return { data, timing: Date.now() - start };
    }
  });

  const runBasicTests = async () => {
    setIsRunning(true);
    const testResults: TestResult[] = [];

    // Test 1: Authentication State
    testResults.push({
      name: "Authentication System",
      status: authLoading ? 'loading' : (isAuthenticated ? 'pass' : 'fail'),
      message: authLoading ? 'Checking auth...' : (isAuthenticated ? `Logged in as ${user?.firstName || 'User'}` : 'Not authenticated - try logging in')
    });

    // Test 2: API Health
    testResults.push({
      name: "API Health Check",
      status: healthLoading ? 'loading' : (healthData?.status === 'healthy' ? 'pass' : 'fail'),
      message: healthLoading ? 'Checking server...' : (healthData?.status === 'healthy' ? `Server healthy (${healthData.timing}ms)` : 'Server unhealthy'),
      timing: healthData?.timing
    });

    // Test 3: Database Connectivity
    testResults.push({
      name: "Database - Counties",
      status: countiesLoading ? 'loading' : (countiesData?.data?.length > 0 ? 'pass' : 'fail'),
      message: countiesLoading ? 'Loading counties...' : (countiesData?.data?.length > 0 ? `${countiesData?.data.length} counties loaded (${countiesData?.timing ?? 0}ms)` : 'No counties found'),
      timing: countiesData?.timing
    });

    // Test 4: Trades Data
    testResults.push({
      name: "Database - Trades",
      status: tradesLoading ? 'loading' : (tradesData?.data?.length > 0 ? 'pass' : 'fail'),
      message: tradesLoading ? 'Loading trades...' : (tradesData?.data?.length > 0 ? `${tradesData?.data.length} trades loaded (${tradesData?.timing ?? 0}ms)` : 'No trades found'),
      timing: tradesData?.timing
    });

    // Test 5: Contractors Data
    testResults.push({
      name: "Database - Contractors",
      status: contractorsLoading ? 'loading' : (contractorsData?.data?.length > 0 ? 'pass' : 'fail'),
      message: contractorsLoading ? 'Loading contractors...' : (contractorsData?.data?.length > 0 ? `${contractorsData?.data.length} contractors loaded (${contractorsData?.timing ?? 0}ms)` : 'No contractors found'),
      timing: contractorsData?.timing
    });

    // Test Quote Calculator
    try {
      const calcStart = Date.now();
      const calcResponse = await apiRequest('POST', '/api/calculator', {
        projectType: 'roof-replacement',
        squareFootage: '2000',
        urgency: 'planning',
        stateCode: 'CA',
        countyFips: '06037'
      });
      const calcTiming = Date.now() - calcStart;

      testResults.push({
        name: "Quote Calculator",
        status: calcResponse?.low && calcResponse?.high ? 'pass' : 'fail',
        message: calcResponse?.low && calcResponse?.high ? `Calculator working: $${calcResponse.low}-$${calcResponse.high} (${calcTiming}ms)` : 'Calculator failed',
        timing: calcTiming
      });
    } catch (error) {
      testResults.push({
        name: "Quote Calculator",
        status: 'fail',
        message: `Calculator error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    setTests(testResults);
    setIsRunning(false);
  };

  useEffect(() => {
    runBasicTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'loading': return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-600">PASS</Badge>;
      case 'fail': return <Badge className="bg-red-600">FAIL</Badge>;
      case 'loading': return <Badge className="bg-yellow-600">LOADING</Badge>;
    }
  };

  const passedTests = tests.filter(t => t.status === 'pass').length;
  const totalTests = tests.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">
          TradeScout Functionality Test
        </h1>
        <p className="text-white/70 mb-4">
          Testing core functionality and API endpoints
        </p>
        <div className="flex items-center gap-4">
          <Badge className="bg-tsCard">
            {passedTests}/{totalTests} Tests Passed
          </Badge>
          <Button 
            onClick={runBasicTests} 
            disabled={isRunning}
            className="bg-ts-orange hover:bg-ts-orange-dark"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests Again'}
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-4 text-center">
            <Server className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-white/70">Server Status</p>
            <p className="text-lg font-bold text-white">
              {healthData?.status === 'healthy' ? 'Online' : 'Checking...'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-4 text-center">
            <Database className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-white/70">Database</p>
            <p className="text-lg font-bold text-white">
              {countiesData?.data?.length > 0 ? 'Connected' : 'Checking...'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-4 text-center">
            <Wifi className="h-8 w-8 text-ts-orange mx-auto mb-2" />
            <p className="text-sm text-white/70">Auth System</p>
            <p className="text-lg font-bold text-white">
              {isAuthenticated ? 'Authenticated' : 'Not Logged In'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-white/70">Overall Health</p>
            <p className="text-lg font-bold text-white">
              {Math.round((passedTests / totalTests) * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tests.map((test, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-tsCard rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <h4 className="text-white font-medium">{test.name}</h4>
                    <p className="text-white/70 text-sm">{test.message}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {test.timing && (
                    <span className="text-white/60 text-sm">{test.timing}ms</span>
                  )}
                  {getStatusBadge(test.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Information */}
      {isAuthenticated && user && (
        <Card className="bg-tsCard border-white/10 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Current User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-white/70 text-sm">Name</p>
                <p className="text-white">{user.firstName} {user.lastName}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Email</p>
                <p className="text-white">{user.email}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Role</p>
                <Badge>{user.role}</Badge>
              </div>
              <div>
                <p className="text-white/70 text-sm">Address Verified</p>
                <Badge className={user.addressVerified ? 'bg-green-600' : 'bg-yellow-600'}>
                  {user.addressVerified ? 'Verified' : 'Pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}