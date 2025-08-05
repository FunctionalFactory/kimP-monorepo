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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  Refresh,
  Assessment,
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

interface BacktestSession {
  id: string;
  status: string;
  parameters: any;
  results?: BacktestResults;
  startTime?: string;
  endTime?: string;
  createdAt: string;
}

interface BacktestResults {
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
}

interface Trade {
  timestamp: string;
  symbol: string;
  action: string;
  price: number;
  amount: number;
  profit: number;
}

export default function ResultsDashboard() {
  const [sessions, setSessions] = useState<BacktestSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest/sessions');
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
        if (data.data.length > 0 && !selectedSession) {
          setSelectedSession(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('세션 조회 실패:', error);
      setError('백테스트 세션을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getCurrentSession = () => {
    return sessions.find((session) => session.id === selectedSession);
  };

  const currentSession = getCurrentSession();

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
        <Button onClick={fetchSessions} startIcon={<Refresh />}>
          다시 시도
        </Button>
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
        <Typography variant="h4">백테스트 결과 대시보드</Typography>
        <Button onClick={fetchSessions} startIcon={<Refresh />}>
          새로고침
        </Button>
      </Box>

      {/* 세션 선택 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
            백테스트 세션 선택
          </Typography>

          <FormControl fullWidth>
            <InputLabel>세션 선택</InputLabel>
            <Select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              {sessions.map((session) => (
                <MenuItem key={session.id} value={session.id}>
                  {session.id} - {session.status} -{' '}
                  {new Date(session.createdAt).toLocaleString()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {!currentSession ? (
        <Alert severity="info">
          백테스트 세션이 없습니다. 먼저 백테스트를 실행해주세요.
        </Alert>
      ) : (
        <>
          {/* 세션 정보 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                세션 정보
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    세션 ID: {currentSession.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    상태: {currentSession.status}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    생성일:{' '}
                    {new Date(currentSession.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    최소 스프레드: {currentSession.parameters.minSpread}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    최대 손실: {currentSession.parameters.maxLoss}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    투자 금액:{' '}
                    {formatCurrency(currentSession.parameters.investmentAmount)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 결과가 있는 경우에만 표시 */}
          {currentSession.results ? (
            <>
              {/* 주요 지표 */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        {currentSession.results.netProfit >= 0 ? (
                          <TrendingUp color="success" />
                        ) : (
                          <TrendingDown color="error" />
                        )}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          순손익
                        </Typography>
                      </Box>
                      <Typography
                        variant="h4"
                        color={
                          currentSession.results.netProfit >= 0
                            ? 'success.main'
                            : 'error.main'
                        }
                      >
                        {formatCurrency(currentSession.results.netProfit)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <AccountBalance color="primary" />
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          승률
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {formatPercentage(currentSession.results.winRate)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <ShowChart color="primary" />
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          총 거래 수
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {currentSession.results.totalTrades}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <TrendingUp color="primary" />
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          최대 손실
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {formatPercentage(currentSession.results.maxDrawdown)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 거래 내역 */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    거래 내역
                  </Typography>
                  {currentSession.results.trades.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', py: 3 }}
                    >
                      이 백테스트에서 거래가 없습니다.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>시간</TableCell>
                            <TableCell>심볼</TableCell>
                            <TableCell>행동</TableCell>
                            <TableCell>가격</TableCell>
                            <TableCell>수량</TableCell>
                            <TableCell>손익</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currentSession.results.trades.map((trade, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {new Date(trade.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell>{trade.symbol}</TableCell>
                              <TableCell>
                                <Chip
                                  label={trade.action}
                                  color={
                                    trade.action.includes('BUY')
                                      ? 'primary'
                                      : 'secondary'
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {formatCurrency(trade.price)}
                              </TableCell>
                              <TableCell>{trade.amount}</TableCell>
                              <TableCell>
                                <Typography
                                  color={
                                    trade.profit >= 0
                                      ? 'success.main'
                                      : 'error.main'
                                  }
                                >
                                  {formatCurrency(trade.profit)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert severity="info">
              이 세션의 백테스트가 아직 완료되지 않았습니다. 상태:{' '}
              {currentSession.status}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
