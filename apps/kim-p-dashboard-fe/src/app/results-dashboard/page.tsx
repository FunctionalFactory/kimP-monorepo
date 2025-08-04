'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  Refresh,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';

interface BacktestResults {
  totalPnL: number;
  roi: number;
  totalTrades: number;
  winRate: number;
  trades: Trade[];
  portfolioHistory: PortfolioPoint[];
}

interface Trade {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  pnl: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

interface PortfolioPoint {
  timestamp: string;
  value: number;
}

export default function ResultsDashboard() {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        'http://localhost:4000/api/backtest/results',
      );
      setResults(response.data);
    } catch (error) {
      console.error('Fetch results error:', error);
      setError('Failed to fetch backtest results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Refresh onClick={fetchResults} sx={{ cursor: 'pointer' }} />
        </Box>
      </Box>
    );
  }

  if (!results) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Results Dashboard
        </Typography>
        <Alert severity="info">
          No backtest results available. Run a backtest first to see results
          here.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Results Dashboard</Typography>
        <Refresh onClick={fetchResults} sx={{ cursor: 'pointer' }} />
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {results.totalPnL >= 0 ? (
                  <TrendingUp color="success" />
                ) : (
                  <TrendingDown color="error" />
                )}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Total P&L
                </Typography>
              </Box>
              <Typography
                variant="h4"
                color={results.totalPnL >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(results.totalPnL)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AccountBalance color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  ROI
                </Typography>
              </Box>
              <Typography
                variant="h4"
                color={results.roi >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPercentage(results.roi)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ShowChart color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Total Trades
                </Typography>
              </Box>
              <Typography variant="h4">{results.totalTrades}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Win Rate
                </Typography>
              </Box>
              <Typography variant="h4">
                {formatPercentage(results.winRate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Portfolio Performance Chart */}
      {results.portfolioHistory && results.portfolioHistory.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Portfolio Performance
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={results.portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [
                    formatCurrency(value),
                    'Portfolio Value',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trade History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Trade History
          </Typography>
          {results.trades.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', py: 3 }}
            >
              No trades found in this backtest.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>P&L</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        {new Date(trade.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trade.type}
                          color={trade.type === 'BUY' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(trade.price)}</TableCell>
                      <TableCell>{trade.quantity}</TableCell>
                      <TableCell>
                        <Typography
                          color={trade.pnl >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(trade.pnl)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trade.status}
                          color={
                            trade.status === 'COMPLETED'
                              ? 'success'
                              : trade.status === 'PENDING'
                                ? 'warning'
                                : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
