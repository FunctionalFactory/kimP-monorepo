'use client';

import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { CloudUpload, PlayArrow, Assessment } from '@mui/icons-material';
import Link from 'next/link';

export default function Home() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        kimP Backtesting Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome to the kimP arbitrage backtesting dashboard. Use the navigation
        menu to manage your data, run backtests, and view results.
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <CloudUpload
                sx={{ fontSize: 40, color: 'primary.main', mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                Data Management
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Upload historical CSV data files for backtesting analysis.
              </Typography>
              <Button
                component={Link}
                href="/data-management"
                variant="contained"
                startIcon={<CloudUpload />}
              >
                Manage Data
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <PlayArrow sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Run Backtest
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Follow step-by-step instructions to run your backtest.
              </Typography>
              <Button
                component={Link}
                href="/run-backtest"
                variant="contained"
                startIcon={<PlayArrow />}
              >
                Start Backtest
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Assessment sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Results Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                View detailed backtesting results and performance metrics.
              </Typography>
              <Button
                component={Link}
                href="/results-dashboard"
                variant="contained"
                startIcon={<Assessment />}
              >
                View Results
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
