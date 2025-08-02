'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle,
  PlayArrow,
  Settings,
  Assessment,
  Terminal,
  Warning,
} from '@mui/icons-material';

const steps = [
  {
    label: 'Select Dataset',
    description:
      'Choose the historical dataset you want to use for backtesting.',
    details: [
      'Go to the Data Management page',
      'Upload your CSV file with historical price data',
      'Ensure the data format is correct (timestamp, price, volume)',
      'Verify the dataset appears in the list',
    ],
  },
  {
    label: 'Start Feeder in Backtest Mode',
    description: 'Launch the price feeder service in backtesting mode.',
    details: [
      'Open a terminal in the kimP-monorepo directory',
      'Navigate to the feeder service: cd apps/kim-p-feeder',
      'Run: npm run start:backtest',
      'Wait for the feeder to start and connect to the dataset',
    ],
  },
  {
    label: 'Start Initiator Service',
    description: 'Launch the arbitrage opportunity scanner.',
    details: [
      'Open another terminal',
      'Navigate to: cd apps/kim-p-initiator',
      'Run: npm run start',
      'The initiator will scan for arbitrage opportunities',
    ],
  },
  {
    label: 'Start Finalizer Service',
    description: 'Launch the trade execution service.',
    details: [
      'Open a third terminal',
      'Navigate to: cd apps/kim-p-finalizer',
      'Run: npm run start',
      'The finalizer will execute trades based on opportunities',
    ],
  },
  {
    label: 'Monitor and View Results',
    description: 'Check the results dashboard for backtesting performance.',
    details: [
      'Wait for the backtest to complete',
      'Go to the Results Dashboard page',
      'View key metrics: Total P&L, ROI, Trade Count, Win Rate',
      'Analyze the trade history and portfolio performance',
    ],
  },
];

export default function RunBacktest() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Run Backtest
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Follow these steps to run a backtest using the kimP arbitrage system.
          Make sure all services are properly configured before starting.
        </Typography>
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Prerequisites
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="primary" />
              </ListItemIcon>
              <ListItemText primary="Historical CSV data uploaded via Data Management" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="primary" />
              </ListItemIcon>
              <ListItemText primary="All microservices properly configured" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="primary" />
              </ListItemIcon>
              <ListItemText primary="Database and Redis connections established" />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step-by-Step Instructions
          </Typography>

          <Stepper orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label} active={true}>
                <StepLabel>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {step.description}
                  </Typography>

                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <List dense>
                      {step.details.map((detail, detailIndex) => (
                        <ListItem key={detailIndex} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <Typography variant="body2" color="primary">
                              {detailIndex + 1}.
                            </Typography>
                          </ListItemIcon>
                          <ListItemText
                            primary={detail}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>

                  {index < steps.length - 1 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Complete this step before proceeding to the next one.
                      </Typography>
                    </Box>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Important Notes
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Backtest Mode:</strong> The system will run in simulation
              mode and will not execute real trades.
            </Typography>
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Performance:</strong> Backtest duration depends on the
              size of your historical dataset.
            </Typography>
          </Alert>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Monitoring:</strong> Check the terminal outputs for any
              errors or warnings during execution.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
