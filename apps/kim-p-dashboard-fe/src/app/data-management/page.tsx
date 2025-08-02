'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import { CloudUpload, Refresh } from '@mui/icons-material';
import axios from 'axios';

interface Dataset {
  id: string;
  name: string;
  uploadDate: string;
  size: string;
  status: string;
}

export default function DataManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: 'Please select a valid CSV file.' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        'http://localhost:3001/api/backtest/upload-data',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setMessage({ type: 'success', text: 'File uploaded successfully!' });
      setFile(null);
      fetchDatasets();
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({
        type: 'error',
        text: 'Failed to upload file. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        'http://localhost:3001/api/backtest/datasets',
      );
      setDatasets(response.data);
    } catch (error) {
      console.error('Fetch datasets error:', error);
      setMessage({ type: 'error', text: 'Failed to fetch datasets.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Data Management
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Historical Data
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload CSV files containing historical price data for backtesting.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUpload />}
              disabled={uploading}
            >
              Select CSV File
              <input
                type="file"
                hidden
                accept=".csv"
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2">Selected: {file.name}</Typography>
            )}
          </Box>

          {file && (
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading}
              startIcon={
                uploading ? <CircularProgress size={20} /> : <CloudUpload />
              }
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          )}

          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </CardContent>
      </Card>

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
            <Typography variant="h6">Historical Datasets</Typography>
            <Button
              startIcon={<Refresh />}
              onClick={fetchDatasets}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : datasets.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', py: 3 }}
            >
              No datasets found. Upload a CSV file to get started.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Upload Date</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>{dataset.name}</TableCell>
                      <TableCell>{dataset.uploadDate}</TableCell>
                      <TableCell>{dataset.size}</TableCell>
                      <TableCell>{dataset.status}</TableCell>
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
