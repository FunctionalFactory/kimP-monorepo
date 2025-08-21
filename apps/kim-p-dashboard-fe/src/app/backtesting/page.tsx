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
  CircularProgress,
  Paper,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Settings,
  Assessment,
  AccountBalance,
  TrendingUp,
} from '@mui/icons-material';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  originalFileName: string;
  fileSize: number;
  createdAt: string;
}

interface BacktestParameters {
  datasetId: string;
  totalCapital: number;
  investmentAmount: number;
  minSpread: number;
  maxLoss: number;
}

interface BacktestSession {
  sessionId: string;
  status: string;
  parameters: BacktestParameters;
  dataset: {
    id: string;
    name: string;
  };
}

export default function BacktestingPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<BacktestSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<BacktestParameters>({
    datasetId: '',
    totalCapital: 10000000, // 1천만원
    investmentAmount: 1000000, // 100만원
    minSpread: 0.5,
    maxLoss: 10,
  });

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/datasets');
      const data = await response.json();

      if (data.success) {
        setDatasets(data.datasets);
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

  const handleInputChange = (
    field: keyof BacktestParameters,
    value: string | number,
  ) => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const isFormValid = () => {
    return formData.datasetId && formData.totalCapital > 0 && formData.investmentAmount > 0 && !loading;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        백테스팅 실행
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          업로드된 데이터셋을 선택하고 투자 전략을 설정하여 백테스팅을 실행하세요.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* 데이터셋 선택 */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">데이터셋 선택</Typography>
              </Box>

              <Stack spacing={3}>
                <FormControl fullWidth>
                  <InputLabel>백테스팅 데이터셋 *</InputLabel>
                  <Select
                    value={formData.datasetId}
                    onChange={(e) =>
                      handleInputChange('datasetId', e.target.value)
                    }
                    disabled={loading}
                  >
                    {datasets.map((dataset) => (
                      <MenuItem key={dataset.id} value={dataset.id}>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {dataset.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dataset.originalFileName} • {formatFileSize(dataset.fileSize)} • {formatDate(dataset.createdAt)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {datasets.length === 0 && !loading && (
                  <Alert severity="warning">
                    업로드된 데이터셋이 없습니다. 먼저 Data Management에서 CSV 파일을 업로드해주세요.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* 전략 파라미터 */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Settings sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">투자 전략 설정</Typography>
              </Box>

              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="총 자본금 (KRW) *"
                  type="number"
                  value={formData.totalCapital}
                  onChange={(e) =>
                    handleInputChange(
                      'totalCapital',
                      parseInt(e.target.value) || 0,
                    )
                  }
                  inputProps={{ min: 1000000 }}
                  helperText="백테스팅에 사용할 총 자본금"
                  InputProps={{
                    startAdornment: (
                      <AccountBalance sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="세션당 투자 금액 (KRW) *"
                  type="number"
                  value={formData.investmentAmount}
                  onChange={(e) =>
                    handleInputChange(
                      'investmentAmount',
                      parseInt(e.target.value) || 0,
                    )
                  }
                  inputProps={{ min: 100000 }}
                  helperText="각 거래 세션에서 사용할 투자 금액"
                  InputProps={{
                    startAdornment: (
                      <AccountBalance sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="최소 진입 스프레드 (%)"
                  type="number"
                  value={formData.minSpread}
                  onChange={(e) =>
                    handleInputChange(
                      'minSpread',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  inputProps={{ step: 0.1, min: 0 }}
                  helperText="차익거래를 시작할 최소 스프레드 비율"
                  InputProps={{
                    startAdornment: (
                      <TrendingUp sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="최대 손실 제한 (%)"
                  type="number"
                  value={formData.maxLoss}
                  onChange={(e) =>
                    handleInputChange(
                      'maxLoss',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                  helperText="손실 제한 비율 (0-100%)"
                  InputProps={{
                    startAdornment: (
                      <TrendingUp sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
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
            <Typography variant="h6">백테스팅 실행</Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {session && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>백테스팅 세션이 성공적으로 생성되었습니다!</strong>
                <br />
                세션 ID: {session.sessionId}
                <br />
                데이터셋: {session.dataset.name}
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
            {loading ? '백테스팅 시작 중...' : '백테스팅 시작'}
          </Button>

          {session && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                백테스팅 진행 상황:
              </Typography>
              <Typography variant="body2" paragraph>
                백테스팅이 자동으로 시작되었습니다. 진행 상황은 시스템 로그에서 확인할 수 있습니다.
              </Typography>
              <Typography variant="body2">
                완료 후 Results Dashboard에서 상세한 결과를 확인하세요.
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
