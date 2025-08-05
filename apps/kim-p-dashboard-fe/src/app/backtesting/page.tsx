'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Paper,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Settings,
  Assessment,
  CheckCircle,
  Error,
  CalendarToday,
  TrendingUp,
  AccountBalance,
} from '@mui/icons-material';

interface Dataset {
  id: string;
  name: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  status: string;
}

interface BacktestParameters {
  minSpread: number;
  maxLoss: number;
  investmentAmount: number;
  upbitSymbol: string;
  binanceSymbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
}

interface BacktestSession {
  sessionId: string;
  status: string;
  parameters: BacktestParameters;
}

export default function BacktestingPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<BacktestSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<BacktestParameters>({
    minSpread: 0.5,
    maxLoss: 0.1,
    investmentAmount: 1000000,
    upbitSymbol: '',
    binanceSymbol: '',
    timeframe: '1m',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/backtest/datasets');
      const data = await response.json();
      if (data.success) {
        setDatasets(data.data);
      } else {
        setError('데이터셋을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('데이터셋 조회 실패:', error);
      setError('데이터셋을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BacktestParameters, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStartBacktest = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSession(data.data);
        setError(null);
      } else {
        setError(data.message || '백테스트 세션 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('백테스트 시작 실패:', error);
      setError('백테스트를 시작하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getUpbitDatasets = () => {
    return datasets.filter((dataset) => dataset.exchange.toLowerCase() === 'upbit');
  };

  const getBinanceDatasets = () => {
    return datasets.filter((dataset) => dataset.exchange.toLowerCase() === 'binance');
  };

  const isFormValid = () => {
    return formData.upbitSymbol && formData.binanceSymbol && !loading;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        백테스팅 컨트롤 패널
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          차익거래 전략의 파라미터를 설정하고 백테스트를 실행하세요. 결과는
          Results Dashboard에서 확인할 수 있습니다.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* 파라미터 설정 */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Settings sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">전략 파라미터</Typography>
              </Box>

              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="최소 진입 스프레드 (%)"
                  type="number"
                  value={formData.minSpread}
                  onChange={(e) =>
                    handleInputChange('minSpread', parseFloat(e.target.value) || 0)
                  }
                  inputProps={{ step: 0.1, min: 0 }}
                  helperText="차익거래를 시작할 최소 스프레드 비율"
                  InputProps={{
                    startAdornment: <TrendingUp sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />

                <TextField
                  fullWidth
                  label="최대 재균형 손실 (%)"
                  type="number"
                  value={formData.maxLoss}
                  onChange={(e) =>
                    handleInputChange('maxLoss', parseFloat(e.target.value) || 0)
                  }
                  inputProps={{ step: 0.1, min: 0 }}
                  helperText="재균형 시 허용할 최대 손실 비율"
                  InputProps={{
                    startAdornment: <Error sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />

                <TextField
                  fullWidth
                  label="거래당 투자 금액 (KRW)"
                  type="number"
                  value={formData.investmentAmount}
                  onChange={(e) =>
                    handleInputChange(
                      'investmentAmount',
                      parseInt(e.target.value) || 0,
                    )
                  }
                  inputProps={{ min: 10000 }}
                  helperText="각 거래에서 사용할 투자 금액"
                  InputProps={{
                    startAdornment: <AccountBalance sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel>타임프레임</InputLabel>
                  <Select
                    value={formData.timeframe}
                    onChange={(e) =>
                      handleInputChange('timeframe', e.target.value)
                    }
                  >
                    <MenuItem value="1m">1분</MenuItem>
                    <MenuItem value="3m">3분</MenuItem>
                    <MenuItem value="5m">5분</MenuItem>
                    <MenuItem value="15m">15분</MenuItem>
                    <MenuItem value="30m">30분</MenuItem>
                    <MenuItem value="1h">1시간</MenuItem>
                    <MenuItem value="4h">4시간</MenuItem>
                    <MenuItem value="1d">1일</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* 데이터셋 선택 */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">데이터셋 선택</Typography>
              </Box>

              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    거래소 선택
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label="UPBIT" 
                      color="primary" 
                      variant="outlined"
                      sx={{ flex: 1 }}
                    />
                    <Chip 
                      label="BINANCE" 
                      color="primary" 
                      variant="outlined"
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </Box>

                <FormControl fullWidth>
                  <InputLabel>Upbit 데이터셋</InputLabel>
                  <Select
                    value={formData.upbitSymbol}
                    onChange={(e) =>
                      handleInputChange('upbitSymbol', e.target.value)
                    }
                  >
                    {getUpbitDatasets().map((dataset) => (
                      <MenuItem key={dataset.id} value={dataset.symbol}>
                        {dataset.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Binance 데이터셋</InputLabel>
                  <Select
                    value={formData.binanceSymbol}
                    onChange={(e) =>
                      handleInputChange('binanceSymbol', e.target.value)
                    }
                  >
                    {getBinanceDatasets().map((dataset) => (
                      <MenuItem key={dataset.id} value={dataset.symbol}>
                        {dataset.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    기간 설정 (선택사항)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="시작 날짜"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        handleInputChange('startDate', e.target.value)
                      }
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                    <TextField
                      fullWidth
                      label="종료 날짜"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        handleInputChange('endDate', e.target.value)
                      }
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* 백테스트 실행 */}
      <Card sx={{ mt: 3 }} elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <PlayArrow sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">백테스트 실행</Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {session && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>백테스트 세션이 생성되었습니다!</strong>
                <br />
                세션 ID: {session.sessionId}
                <br />
                상태: {session.status}
              </Typography>
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            onClick={handleStartBacktest}
            disabled={!isFormValid()}
            startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
            sx={{ mt: 2 }}
          >
            {loading ? '백테스트 시작 중...' : '백테스트 시작'}
          </Button>

          {session && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                다음 단계:
              </Typography>
              <Typography variant="body2" paragraph>
                1. 터미널에서 다음 명령어를 실행하세요:
              </Typography>
              <Box
                component="pre"
                sx={{
                  bgcolor: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  overflow: 'auto',
                }}
              >
                {`cd apps/kim-p-feeder
SESSION_ID=${session.sessionId} FEEDER_MODE=backtest npm run start`}
              </Box>
              <Typography variant="body2" sx={{ mt: 1 }}>
                2. 백테스트가 완료되면 Results Dashboard에서 결과를 확인하세요.
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
