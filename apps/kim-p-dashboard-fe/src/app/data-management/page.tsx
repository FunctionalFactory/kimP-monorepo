'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Event,
  Storage,
  Refresh,
} from '@mui/icons-material';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  originalFileName: string;
  fileSize: number;
  createdAt: string;
}

export default function DataManagementPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/datasets');
      const data = await response.json();

      if (data.success) {
        setDatasets(data.datasets);
      } else {
        setError('데이터셋 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.file) {
      setError('데이터셋 이름과 파일을 모두 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadData = new FormData();
      uploadData.append('file', formData.file);
      uploadData.append('name', formData.name);
      if (formData.description) {
        uploadData.append('description', formData.description);
      }

      const response = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: uploadData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('데이터셋이 성공적으로 업로드되었습니다.');
        setFormData({ name: '', description: '', file: null });
        fetchDatasets(); // 목록 새로고침
      } else {
        setError(data.message || '업로드에 실패했습니다.');
      }
    } catch (error) {
      setError('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Description sx={{ mr: 1, fontSize: 28 }} />
        <Typography variant="h4" component="h1">
          데이터 관리
        </Typography>
      </Box>

      {/* 업로드 섹션 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            새 데이터셋 업로드
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            백테스팅에 사용할 CSV 파일을 업로드하세요. 필수 컬럼: timestamp,
            open, high, low, close, volume
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                label="데이터셋 이름 *"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="예: ADA 6개월 1분봉 데이터"
                required
                sx={{ minWidth: 300 }}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                disabled={uploading}
              >
                CSV 파일 선택
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  required
                />
              </Button>
            </Box>

            <TextField
              label="설명 (선택사항)"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="데이터셋에 대한 설명을 입력하세요"
              multiline
              rows={3}
              fullWidth
              sx={{ mb: 2 }}
            />

            {formData.file && (
              <Alert severity="info" sx={{ mb: 2 }}>
                선택된 파일: {formData.file.name}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              disabled={uploading}
              startIcon={
                uploading ? <CircularProgress size={20} /> : <CloudUpload />
              }
            >
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 데이터셋 목록 */}
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6">업로드된 데이터셋</Typography>
            <Button
              startIcon={<Refresh />}
              onClick={fetchDatasets}
              disabled={loading}
            >
              새로고침
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" paragraph>
            현재 등록된 모든 데이터셋 목록입니다.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : datasets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                업로드된 데이터셋이 없습니다.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>이름</TableCell>
                    <TableCell>파일명</TableCell>
                    <TableCell>크기</TableCell>
                    <TableCell>업로드 날짜</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {dataset.name}
                          </Typography>
                          {dataset.description && (
                            <Typography variant="body2" color="text.secondary">
                              {dataset.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {dataset.originalFileName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Storage sx={{ mr: 1, fontSize: 16 }} />
                          {formatFileSize(dataset.fileSize)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Event sx={{ mr: 1, fontSize: 16 }} />
                          {formatDate(dataset.createdAt)}
                        </Box>
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
