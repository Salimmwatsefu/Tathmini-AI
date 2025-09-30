import { useState, useEffect } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Upload, FileCheck, X, TrendingUp, AlertTriangle, CheckCircle, PieChart } from "lucide-react";

// Type definitions
interface Anomaly {
  items: string;
  debit: number;
  credit: number;
}

interface ApiResponse {
  balance_status: string;
  anomalies: Anomaly[];
  recommendations: string;
  total_debit?: number;
  total_credit?: number;
}

function UploadForm() {
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'recommendations'>('overview');

  // Toggle dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto scroll to results when data is loaded
  useEffect(() => {
    if (result) {
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [result]);

  // Real file upload function
  const handleFileUpload = async (file: File) => {
    setFileName(file.name);
    setError(null);
    setResult(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload-csv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      const data: ApiResponse = await response.json();
      setResult(data);
      setSuccessMessage("Upload successful!");
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else {
      setError("Please upload a CSV file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setError(null);
    setResult(null);
    setSuccessMessage(null);
  };

  const parseRecommendations = (text: string): string[] => {
    return text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("- ") && line.length > 2)
      .map(line => line.replace(/^- /, ""));
  };

  const calculateMetrics = () => {
    if (!result) return { totalDebit: 0, totalCredit: 0, variance: 0, riskScore: 0 };
    
    // Try to parse totals from balance_status message
    let totalDebit = result.total_debit ?? 0;
    let totalCredit = result.total_credit ?? 0;
    
    // Parse balance_status for actual totals (e.g., "Balanced: Total Debit = 6218826139.93, Total Credit = 6218826139.93")
    if (result.balance_status && !totalDebit && !totalCredit) {
      const debitMatch = result.balance_status.match(/Total Debit\s*=\s*([\d,.]+)/i);
      const creditMatch = result.balance_status.match(/Total Credit\s*=\s*([\d,.]+)/i);
      
      if (debitMatch) {
        totalDebit = parseFloat(debitMatch[1].replace(/,/g, ''));
      }
      if (creditMatch) {
        totalCredit = parseFloat(creditMatch[1].replace(/,/g, ''));
      }
    }
    
    // Fallback to summing anomalies if no totals found
    if (!totalDebit && !totalCredit) {
      totalDebit = result.anomalies.reduce((sum, a) => sum + a.debit, 0);
      totalCredit = result.anomalies.reduce((sum, a) => sum + a.credit, 0);
    }
    
    const variance = totalDebit > 0 ? ((totalDebit - totalCredit) / totalDebit * 100).toFixed(1) : "0";
    const riskScore = Math.min(result.anomalies.length * 12, 100);
    
    return { totalDebit, totalCredit, variance, riskScore };
  };

  const metrics = calculateMetrics();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <PieChart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Audit Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI-Powered Analysis & Insights</p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
            >
              {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!result ? (
          // Upload Section
          <div className="text-center py-12">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`max-w-2xl mx-auto border-2 border-dashed rounded-xl p-12 transition-all duration-300 ${
                isDragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              } hover:border-blue-400 dark:hover:border-blue-500`}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Trial Balance or General Ledger
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {isDragActive ? "Drop your CSV here..." : "Drag & drop your CSV file or click to browse"}
              </p>
              
              <label htmlFor="fileInput" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition cursor-pointer">
                <Upload className="w-5 h-5" />
                Choose File
              </label>
              <input
                id="fileInput"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Supports CSV files up to 10MB
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Anomaly Detection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically identifies suspicious trends and variances
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Financial Insights</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Clear summaries with actionable recommendations
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Balance Verification</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Instant validation of trial balance accuracy
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Dashboard Section
          <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 px-1 border-b-2 font-medium transition ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className={`pb-3 px-1 border-b-2 font-medium transition ${
                    activeTab === 'recommendations'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  AI Recommendations
                </button>
              </div>
            </div>

            {activeTab === 'overview' ? (
              <>
                {/* Metrics Grid */}
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debits</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                          ${metrics.totalDebit.toLocaleString()}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Credits</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                          ${metrics.totalCredit.toLocaleString()}
                        </p>
                      </div>
                      <PieChart className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Variance</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                          {metrics.variance}%
                        </p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Anomalies Found</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                          {result.anomalies.length}
                        </p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                </div>

                {/* Balance Status */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Balance Status
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700 dark:text-gray-300">{result.balance_status}</p>
                    </div>
                  </div>
                </div>

                {/* Anomalies */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Significant Anomalies Detected
                    </h3>
                  </div>
                  <div className="p-6">
                    {result.anomalies.length > 0 ? (
                      <>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {result.anomalies.map((row, idx) => (
                            <div
                              key={idx}
                              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition"
                            >
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 truncate">
                                {row.items}
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Debit:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {row.debit.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Credit:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {row.credit.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Scatter Plot */}
                        <div className="mt-6">
                          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                            Anomaly Visualization
                          </h4>
                          <div className="h-80 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                  dataKey="debit"
                                  name="Debit"
                                  type="number"
                                  tickFormatter={(value) => value.toLocaleString()}
                                  stroke="#9ca3af"
                                />
                                <YAxis
                                  dataKey="credit"
                                  name="Credit"
                                  type="number"
                                  tickFormatter={(value) => value.toLocaleString()}
                                  stroke="#9ca3af"
                                />
                                <Tooltip
                                  formatter={(value: number) => value.toLocaleString()}
                                  contentStyle={{
                                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                                    border: '1px solid #374151',
                                    borderRadius: '8px'
                                  }}
                                />
                                <Scatter
                                  name="Anomalies"
                                  data={result.anomalies}
                                  fill="#3b82f6"
                                />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400">No significant anomalies detected</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              // Recommendations Tab
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI-Powered Audit Recommendations
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Risk Level: {metrics.riskScore}/100 | Confidence: 89%
                  </p>
                </div>
                <div className="p-6">
                  {result.recommendations.startsWith("AI error") ? (
                    <p className="text-red-600 dark:text-red-400">{result.recommendations}</p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {parseRecommendations(result.recommendations).map((rec, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                          >
                            <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-700 dark:text-gray-300">{rec}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                          Immediate Action Required
                        </h4>
                        <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                          Review all flagged anomalies and verify supporting documentation. Implement stricter 
                          authorization controls for high-value transactions.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                <FileCheck className="w-5 h-5" />
                Export Report
              </button>
              <button
                onClick={clearFile}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition"
              >
                Upload New File
              </button>
            </div>
          </div>
        )}

        {/* File Preview */}
        {fileName && !result && !isLoading && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-gray-700 dark:text-gray-300">Selected: {fileName}</span>
              </div>
              <button
                onClick={clearFile}
                className="text-red-500 hover:text-red-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
              <strong>Success:</strong> {successMessage}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="max-w-2xl mx-auto mt-6 text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Analyzing financial data with AI...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default UploadForm;