import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Divider,
} from '@mui/material';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import {
  NotFoundException,
  DecodeHintType,
  BarcodeFormat
} from '@zxing/library';
import { createLogger } from '@services/loggingService';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  open,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef<boolean>(false);
  const scanStartTime = useRef<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showScanningTip, setShowScanningTip] = useState(false);

  // Initialize logger for this component
  const logger = useRef(createLogger('BarcodeScanner'));

  useEffect(() => {
    const handleScannerState = async () => {
      if (open) {
        await logger.current.info('Barcode scanner opened');
        await startScanning();
      } else {
        await logger.current.info('Barcode scanner closed');
        await stopScanning();
      }
    };

    handleScannerState();

    return () => {
      // Cleanup on unmount
      const cleanup = async () => {
        await logger.current.debug('Barcode scanner component unmounting');
        await stopScanning();
      };
      cleanup();
    };
  }, [open]);

  const startScanning = async () => {
    scanStartTime.current = Date.now();

    try {
      await logger.current.info('Starting barcode scanning session');

      setError(null);
      setIsScanning(true);
      setHasPermission(null);
      scanningRef.current = true;

      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Camera access is not available in this desktop application. Please use the manual barcode input below or open this application in a web browser for camera scanning.';
        await logger.current.warn('MediaDevices API not available', {
          hasNavigator: !!navigator,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        });
        throw new Error(errorMsg);
      }

      await logger.current.debug('MediaDevices API available, requesting camera permission');

      // Check for camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      await logger.current.info('Camera permission granted');

      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());

      // Initialize the code reader with enhanced hints for better detection
      codeReader.current = new BrowserMultiFormatReader();

      // Configure hints optimized for food product barcodes
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true); // More thorough scanning

      // Prioritize food product barcode formats (UPC/EAN are most common on food)
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.UPC_A,     // Most common on US food products (12 digits)
        BarcodeFormat.EAN_13,    // Most common on international food products (13 digits)
        BarcodeFormat.UPC_E,     // Compressed UPC for smaller packages (6 digits)
        BarcodeFormat.EAN_8,     // Shorter EAN for small packages (8 digits)
        BarcodeFormat.CODE_128,  // Sometimes used for batch/lot codes
        BarcodeFormat.ITF,       // Used for case/carton codes
        BarcodeFormat.CODE_39,   // Backup format
      ]);

      // Food products often use GS1 standards
      hints.set(DecodeHintType.ASSUME_GS1, true);
      codeReader.current.hints = hints;

      await logger.current.debug('ZXing BrowserMultiFormatReader initialized with enhanced hints');

      // Get available video devices
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();

      await logger.current.debug('Video input devices detected', {
        deviceCount: videoInputDevices.length,
        devices: videoInputDevices.map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind
        }))
      });

      if (videoInputDevices.length === 0) {
        await logger.current.error('No camera devices found');
        throw new Error('No camera devices found');
      }

      // Use the first available camera (usually back camera on mobile)
      const selectedDeviceId = videoInputDevices[0].deviceId;
      await logger.current.info('Selected camera device', {
        deviceId: selectedDeviceId,
        label: videoInputDevices[0].label
      });

      // Start decoding from video element with optimized constraints for barcode scanning
      if (videoRef.current) {
        // Use progressive constraint fallback optimized for barcode scanning
        const constraintOptions = [
          // High quality optimized for barcode scanning
          {
            video: {
              deviceId: selectedDeviceId,
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              facingMode: 'environment', // Prefer back camera for scanning
              frameRate: { ideal: 30, min: 15 },
              focusMode: 'continuous',
              exposureMode: 'continuous',
              whiteBalanceMode: 'continuous',
              // Optimize for close-up scanning
              zoom: { ideal: 1.0, min: 1.0, max: 3.0 }
            }
          },
          // Medium quality with barcode-friendly settings
          {
            video: {
              deviceId: selectedDeviceId,
              width: { ideal: 800, min: 480 },
              height: { ideal: 600, min: 360 },
              facingMode: 'environment',
              frameRate: { ideal: 20, min: 10 },
              focusMode: 'continuous'
            }
          },
          // Basic quality for older devices
          {
            video: {
              deviceId: selectedDeviceId,
              width: 640,
              height: 480,
              facingMode: 'environment'
            }
          },
          // Minimal fallback
          {
            video: {
              facingMode: 'environment'
            }
          },
          // Last resort
          {
            video: true
          }
        ];

        let stream: MediaStream | null = null;

        // Try constraints in order of preference
        for (let i = 0; i < constraintOptions.length; i++) {
          const constraints = constraintOptions[i];
          try {
            await logger.current.debug('Attempting video stream with constraints', {
              attemptNumber: i + 1,
              totalAttempts: constraintOptions.length,
              constraintType: i === 0 ? 'high-quality' : i === 1 ? 'medium-quality' : i === 2 ? 'basic' : i === 3 ? 'environment-only' : 'minimal',
              videoWidth: constraints.video && typeof constraints.video === 'object' ? constraints.video.width : 'auto',
              videoHeight: constraints.video && typeof constraints.video === 'object' ? constraints.video.height : 'auto'
            });
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            await logger.current.info('Video stream constraint successful', {
              attemptNumber: i + 1,
              constraintType: i === 0 ? 'high-quality' : i === 1 ? 'medium-quality' : i === 2 ? 'basic' : i === 3 ? 'environment-only' : 'minimal'
            });
            break;
          } catch (error) {
            await logger.current.warn('Failed to get stream with constraints', {
              attemptNumber: i + 1,
              totalAttempts: constraintOptions.length,
              constraintType: i === 0 ? 'high-quality' : i === 1 ? 'medium-quality' : i === 2 ? 'basic' : i === 3 ? 'environment-only' : 'minimal',
              errorMessage: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : 'Unknown'
            });
            continue;
          }
        }

        if (!stream) {
          throw new Error('Failed to initialize camera with any supported constraints');
        }

        videoRef.current.srcObject = stream;

        // Log actual stream settings
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        await logger.current.info('Video stream initialized successfully', {
          streamActive: stream.active,
          trackCount: stream.getVideoTracks().length,
          actualSettings: {
            width: settings.width || 'unknown',
            height: settings.height || 'unknown',
            frameRate: settings.frameRate || 'unknown',
            facingMode: settings.facingMode || 'unknown',
            deviceId: settings.deviceId || 'unknown',
            aspectRatio: settings.aspectRatio || 'unknown'
          }
        });

        // Wait for video to be ready with extended timeout and better error handling
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            const timeout = setTimeout(() => {
              reject(new Error('Video loading timeout after 15 seconds'));
            }, 15000); // Extended timeout for slower devices

            const cleanup = () => {
              clearTimeout(timeout);
              if (videoRef.current) {
                videoRef.current.onloadedmetadata = null;
                videoRef.current.onerror = null;
                videoRef.current.oncanplay = null;
              }
            };

            videoRef.current.onloadedmetadata = () => {
              cleanup();
              resolve(undefined);
            };

            // Also listen for canplay event as backup
            videoRef.current.oncanplay = () => {
              cleanup();
              resolve(undefined);
            };

            videoRef.current.onerror = (error) => {
              cleanup();
              reject(new Error(`Video loading error: ${error}`));
            };

            // Start playing the video
            videoRef.current.play().catch((playError) => {
              cleanup();
              reject(new Error(`Video play error: ${playError.message}`));
            });
          } else {
            reject(new Error('Video element not available'));
          }
        });

        await logger.current.info('Video element ready for scanning');
        await logger.current.debug('Video mirroring disabled for barcode scanning accuracy');

        // Start continuous scanning
        let scanAttempts = 0;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 50;
        let scanInterval = 150; // Not used but kept for consistency

        // Show scanning tip after a few seconds if no success
        const tipTimeout = setTimeout(() => {
          if (scanningRef.current) {
            setShowScanningTip(true);
          }
        }, 5000);

        controlsRef.current = await codeReader.current.decodeFromVideoElement(videoRef.current, async (result, error, controls) => {
          scanAttempts++;

          // Update debug info periodically with more detailed information
          if (scanAttempts % 10 === 0) {
            const successRate = scanAttempts > 0 ? ((scanAttempts - consecutiveFailures) / scanAttempts * 100).toFixed(1) : '0';
            const scanDuration = Date.now() - scanStartTime.current;
            setDebugInfo(`Scanning... Attempts: ${scanAttempts}, Success Rate: ${successRate}%, Duration: ${Math.round(scanDuration/1000)}s`);

            // Log progress every 50 attempts
            if (scanAttempts % 50 === 0) {
              await logger.current.debug('Scanning progress update', {
                scanAttempts,
                consecutiveFailures,
                successRate: `${successRate}%`,
                scanDuration: `${Math.round(scanDuration/1000)}s`
              });
            }
          }

          if (result && scanningRef.current) {
            const scannedCode = result.getText();
            const scanDuration = Date.now() - scanStartTime.current;

            await logger.current.info('Barcode successfully detected', {
              code: scannedCode,
              format: result.getBarcodeFormat()?.toString(),
              scanDuration,
              scanAttempts,
              consecutiveFailures,
              resultPoints: result.getResultPoints()?.length || 0,
              videoWidth: videoRef.current ? videoRef.current.videoWidth : 0,
              videoHeight: videoRef.current ? videoRef.current.videoHeight : 0
            });

            scanningRef.current = false;
            clearTimeout(tipTimeout);
            setShowScanningTip(false);
            onScan(scannedCode);
            stopScanning();
            onClose();
            return;
          }

          if (error) {
            if (!(error instanceof NotFoundException)) {
              consecutiveFailures++;
              await logger.current.warn('Barcode scanning error', {
                error: error instanceof Error ? error.message : String(error),
                scanAttempts,
                consecutiveFailures,
                scanDuration: Date.now() - scanStartTime.current,
                videoReady: videoRef.current ? !videoRef.current.paused && !videoRef.current.ended : false
              });

              // Reset if too many consecutive failures
              if (consecutiveFailures >= maxConsecutiveFailures) {
                await logger.current.warn('Too many consecutive failures, resetting scanner');
                consecutiveFailures = 0;
              }
            } else {
              // NotFoundException is normal, reset consecutive failures
              consecutiveFailures = 0;
            }
          }
        });
      }
    } catch (err) {
      const scanDuration = Date.now() - scanStartTime.current;

      await logger.current.logError(err, 'Failed to start barcode scanning', {
        scanDuration,
        hasPermission,
        isScanning,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      });

      setHasPermission(false);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          const errorMsg = 'Camera permission denied. Please allow camera access to scan barcodes.';
          setError(errorMsg);
          await logger.current.warn('Camera permission denied by user');
        } else if (err.name === 'NotFoundError') {
          const errorMsg = 'No camera found. Please ensure your device has a camera.';
          setError(errorMsg);
          await logger.current.error('No camera device found');
        } else if (err.name === 'NotReadableError') {
          const errorMsg = 'Camera is already in use by another application. Please close other camera applications and try again.';
          setError(errorMsg);
          await logger.current.error('Camera already in use');
        } else if (err.name === 'OverconstrainedError') {
          const errorMsg = 'Camera constraints could not be satisfied. Please try with a different camera.';
          setError(errorMsg);
          await logger.current.error('Camera constraints not satisfied');
        } else if (err.message.includes('not supported in this environment')) {
          setError(err.message);
          await logger.current.warn('Environment not supported for camera access');
        } else if (err.message.includes('timeout')) {
          const errorMsg = 'Camera initialization timed out. Please try again.';
          setError(errorMsg);
          await logger.current.error('Camera initialization timeout');
        } else {
          setError(`Failed to access camera: ${err.message}`);
          await logger.current.error('Unknown camera access error', { errorMessage: err.message });
        }
      } else {
        setError('Failed to access camera. Please try again.');
        await logger.current.error('Unknown error during camera access', { error: String(err) });
      }
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    const scanDuration = Date.now() - scanStartTime.current;

    await logger.current.debug('Stopping barcode scanning', { scanDuration });

    scanningRef.current = false;

    // Clean up controls
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    // Clean up code reader
    if (codeReader.current) {
      codeReader.current = null;
    }

    // Clean up video stream
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();

        await logger.current.debug('Stopping video tracks', { trackCount: tracks.length });

        tracks.forEach(track => {
          track.stop();
        });

        videoRef.current.srcObject = null;
        await logger.current.debug('Video stream cleaned up successfully');
      } catch (error) {
        await logger.current.warn('Error cleaning up video stream', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    setIsScanning(false);
    await logger.current.info('Barcode scanning session ended', { totalDuration: scanDuration });
  };

  const handleClose = async () => {
    await logger.current.logUserAction('close_barcode_scanner');
    await stopScanning();
    setManualBarcode('');
    onClose();
  };

  const handleManualSubmit = async () => {
    if (manualBarcode.trim()) {
      await logger.current.logUserAction('manual_barcode_submit', {
        code: manualBarcode.trim(),
        codeLength: manualBarcode.trim().length
      });

      onScan(manualBarcode.trim());
      setManualBarcode('');
      onClose();
    }
  };

  const handleManualKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleManualSubmit();
    }
  };

  const handleTestBarcode = async () => {
    // Use a real food product UPC code for testing
    const testBarcode = '041196912586'; // Real UPC-A code (Coca-Cola 12oz can)
    await logger.current.logUserAction('test_barcode_used', {
      code: testBarcode,
      codeLength: testBarcode.length,
      format: 'UPC-A',
      description: 'Food product test barcode'
    });

    onScan(testBarcode);
    setManualBarcode('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid="barcode-scanner-dialog"
    >
      <DialogTitle>Scan Barcode</DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center' }}>
          {hasPermission === null && isScanning && (
            <Box sx={{ mb: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Requesting camera permission...
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {hasPermission && !error && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Position the food product barcode within the camera view. Hold steady and ensure good lighting for best results.
              </Typography>

              {/* Debug information */}
              {debugInfo && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {debugInfo}
                </Typography>
              )}

              {/* Scanning tip */}
              {showScanningTip && (
                <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
                  <strong>Scanning Tip:</strong> Hold the food product steady, ensure good lighting, and keep the barcode flat within the camera view. Try different angles if needed.
                </Alert>
              )}

              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 400,
                  mx: 'auto',
                  bgcolor: 'black',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    // Explicitly prevent mirroring for barcode scanning
                    transform: 'scaleX(1)', // Ensure no horizontal flip
                    // Optimize for barcode scanning
                    objectFit: 'cover',
                    backgroundColor: '#000',
                  }}
                  data-testid="barcode-scanner-video"
                  // Additional video attributes for better barcode scanning
                  playsInline
                  muted
                  autoPlay
                />

                {/* Scanning overlay */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    height: '60%',
                    border: '2px solid #fff',
                    borderRadius: 1,
                    pointerEvents: 'none',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      height: '2px',
                      bgcolor: 'primary.main',
                      animation: 'scan 2s ease-in-out infinite',
                    },
                  }}
                />
              </Box>
            </>
          )}

          {/* Manual barcode input - always show as fallback */}
          <Box sx={{ mt: error ? 2 : hasPermission ? 3 : 0 }}>
            {(error || hasPermission) && (
              <Divider sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  OR
                </Typography>
              </Divider>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter food product barcode manually (UPC/EAN):
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="e.g., 041196912586 (12-13 digits)"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={handleManualKeyPress}
                data-testid="manual-barcode-input"
                size="small"
                inputProps={{
                  pattern: '[0-9]*',
                  inputMode: 'numeric'
                }}
              />
              <Button
                variant="contained"
                onClick={handleManualSubmit}
                disabled={!manualBarcode.trim()}
                data-testid="manual-barcode-submit"
              >
                Submit
              </Button>
            </Box>

            {/* Test barcode button for debugging */}
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestBarcode}
                data-testid="test-barcode-button"
                sx={{ fontSize: '0.75rem' }}
              >
                Use Test Food Product (041196912586)
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} data-testid="barcode-scanner-close">
          Close
        </Button>
      </DialogActions>

      <style>
        {`
          @keyframes scan {
            0%, 100% { transform: translateY(-100%); }
            50% { transform: translateY(100%); }
          }
        `}
      </style>
    </Dialog>
  );
};

export default BarcodeScanner;
