'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Assessment,
  Timeline,
} from '@mui/icons-material';

interface BacktestKPI {
  totalProfitLoss: number;
  totalTrades: number;
  winCount: number;
  winRate: number;
  averageProfitLoss: number;
  initialCapital: number;
  totalRoi: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface TradeDetail {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  initialInvestmentKrw: number;
  totalNetProfitKrw: number;
  totalNetProfitPercent: number;
  profitLoss: number;
  roi: number;
}

interface BacktestResult {
  sessionId: string;
  sessionInfo: {
    id: string;
    status: string;
    createdAt: Date;
    startTime: Date;
    endTime: Date;
    parameters: Record<string, unknown>;
  };
  kpi: BacktestKPI;
  trades: TradeDetail[];
  cumulativeProfit: Array<{
    timestamp: Date;
    cumulativeProfit: number;
  }>;
}

export default function BacktestResultPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchBacktestResult(sessionId);
    }
  }, [sessionId]);

  const fetchBacktestResult = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/backtest/sessions/${id}/results`);
      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.message || '백테스팅 결과를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('백테스팅 결과 조회 실패:', error);
      setError('백테스팅 결과를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'RUNNING':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getProfitLossColor = (value: number) => {
    return value >= 0 ? 'success' : 'error';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">백테스팅 결과를 찾을 수 없습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        백테스팅 결과 분석
      </Typography>

      {/* 세션 정보 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Assessment sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">세션 정보</Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                세션 ID: {result.sessionInfo.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                상태:                 <Chip 
                  label={result.sessionInfo.status} 
                  color={getStatusColor(result.sessionInfo.status) as 'success' | 'error' | 'warning' | 'default'}
                  size="small"
                />
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                생성일: {formatDate(result.sessionInfo.createdAt)}
              </Typography>
              {result.sessionInfo.startTime && (
                <Typography variant="body2" color="text.secondary">
                  시작시간: {formatDate(result.sessionInfo.startTime)}
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* KPI 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="primary">
                  총 손익
                </Typography>
              </Box>
              <Typography 
                variant="h4" 
                color={getProfitLossColor(result.kpi.totalProfitLoss)}
                fontWeight="bold"
              >
                {formatCurrency(result.kpi.totalProfitLoss)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                총수익률: {formatPercentage(result.kpi.totalRoi)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6" color="success.main">
                  승률
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {formatPercentage(result.kpi.winRate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {result.kpi.winCount} / {result.kpi.totalTrades} 거래
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Timeline sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6" color="info.main">
                  총 거래
                </Typography>
              </Box>
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {result.kpi.totalTrades}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                평균: {formatCurrency(result.kpi.averageProfitLoss)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingDown sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6" color="warning.main">
                  최대 낙폭
                </Typography>
              </Box>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {formatPercentage(result.kpi.maxDrawdown)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                샤프 비율: {result.kpi.sharpeRatio.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 거래 상세 내역 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Timeline sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">거래 상세 내역</Typography>
          </Box>

          {result.trades.length === 0 ? (
            <Alert severity="info">거래 내역이 없습니다.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>거래 ID</TableCell>
                    <TableCell>시작 시간</TableCell>
                    <TableCell>종료 시간</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell align="right">투자금액</TableCell>
                    <TableCell align="right">손익</TableCell>
                    <TableCell align="right">수익률</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>{trade.id.substring(0, 8)}...</TableCell>
                      <TableCell>{formatDate(trade.startTime)}</TableCell>
                      <TableCell>{trade.endTime ? formatDate(trade.endTime) : '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={trade.status} 
                          color={getStatusColor(trade.status) as 'success' | 'error' | 'warning' | 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(trade.initialInvestmentKrw)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          color={getProfitLossColor(trade.profitLoss)}
                          fontWeight="bold"
                        >
                          {formatCurrency(trade.profitLoss)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          color={getProfitLossColor(trade.roi)}
                          fontWeight="bold"
                        >
                          {formatPercentage(trade.roi)}
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

      {/* 누적 수익 그래프 (간단한 표 형태로 표시) */}
      {result.cumulativeProfit.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">누적 수익 추이</Typography>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>시간</TableCell>
                    <TableCell align="right">누적 수익</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.cumulativeProfit.slice(-10).map((point, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(point.timestamp)}</TableCell>
                      <TableCell align="right">
                        <Typography 
                          color={getProfitLossColor(point.cumulativeProfit)}
                          fontWeight="bold"
                        >
                          {formatCurrency(point.cumulativeProfit)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
