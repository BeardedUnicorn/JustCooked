import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Queue as QueueIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  GridView as GridViewIcon,
  DoneAll as DoneAllIcon,
  OpenInNew as OpenInNewIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  BatchImportMode,
  BatchImportPreflightResponse,
  BatchImportRequest,
  BatchImportSite,
  QuickStartPack,
  ReImportRequest,
} from '@app-types';
import { batchImportService } from '@services/batchImport';
import { reImportService } from '@services/reImportService';
import { importQueueService } from '@services/importQueue';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import { useAppDispatch } from '@store';
import { addToQueue, addMultipleToQueue } from '@store/slices/importQueueSlice';

interface BatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskAdded?: (taskId: string) => void;
  onOpenQueue?: () => void;
}

interface QueueResultSummary {
  mode: BatchImportMode;
  taskIds: string[];
  requested: number;
  added: number;
  failures: number;
}

interface ConfirmationState {
  open: boolean;
  action: BatchImportMode | null;
  title: string;
  body: string;
}

const RECIPE_CONFIRM_THRESHOLD = 200;
const CATEGORY_CONFIRM_THRESHOLD = 50;
const REIMPORT_CONFIRM_THRESHOLD = 300;
const QUICK_START_URL_CONFIRM_THRESHOLD = 25;

const SITE_LABELS: Record<BatchImportSite, string> = {
  allrecipes: 'AllRecipes',
  americasTestKitchen: 'ATK',
  seriousEats: 'Serious Eats',
  bonAppetit: 'Bon Appétit',
};

const SITE_EXAMPLES: Record<BatchImportSite, string> = {
  allrecipes: 'https://www.allrecipes.com/recipes/79/desserts',
  americasTestKitchen: 'https://www.americastestkitchen.com/recipes/all',
  seriousEats: 'https://www.seriouseats.com/all-recipes-5117985',
  bonAppetit: 'https://www.bonappetit.com/recipes',
};

const MODE_CARD_COPY: Record<BatchImportMode, { title: string; description: string; icon: React.ReactElement }> = {
  url: {
    title: 'From URL',
    description: 'Preview one category URL before it enters the queue.',
    icon: <LinkIcon fontSize="small" />,
  },
  reImport: {
    title: 'Re-import Existing',
    description: 'Reprocess saved recipes with the newest parsing logic.',
    icon: <RefreshIcon fontSize="small" />,
  },
  quickStart: {
    title: 'Curated Quick Start',
    description: 'Choose curated category packs and queue them in bulk.',
    icon: <AutoAwesomeIcon fontSize="small" />,
  },
};

const srOnlySx = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  width: 1,
};

const BatchImportDialog: React.FC<BatchImportDialogProps> = ({
  open,
  onClose,
  onTaskAdded,
  onOpenQueue,
}) => {
  const dispatch = useAppDispatch();

  const quickStartPacks = useMemo<QuickStartPack[]>(() => batchImportService.getQuickStartPacks(), []);
  const suggestions = useMemo(() => batchImportService.getSuggestedCategoryUrls(), []);

  const [mode, setMode] = useState<BatchImportMode>('url');
  const [url, setUrl] = useState('');
  const [selectedSite, setSelectedSite] = useState<BatchImportSite>('allrecipes');
  const [maxRecipes, setMaxRecipes] = useState<number | ''>('');
  const [maxDepth, setMaxDepth] = useState<number | ''>('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [preflight, setPreflight] = useState<BatchImportPreflightResponse | null>(null);
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  const [reImportableCount, setReImportableCount] = useState<number>(0);
  const [isLoadingReImportCount, setIsLoadingReImportCount] = useState(false);
  const [reImportCountError, setReImportCountError] = useState<string | null>(null);
  const [reImportLastUpdatedAt, setReImportLastUpdatedAt] = useState<string | null>(null);

  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [queueingProgress, setQueueingProgress] = useState<{ processed: number; total: number } | null>(null);

  const [isQueueing, setIsQueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueResult, setQueueResult] = useState<QueueResultSummary | null>(null);

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    open: false,
    action: null,
    title: '',
    body: '',
  });

  const existingUrlsRef = useRef<string[] | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const reImportButtonRef = useRef<HTMLButtonElement>(null);
  const quickStartHeadingRef = useRef<HTMLHeadingElement>(null);
  const queueResultHeadingRef = useRef<HTMLHeadingElement>(null);

  const selectedPacks = useMemo(
    () => quickStartPacks.filter(pack => selectedPackIds.includes(pack.id)),
    [quickStartPacks, selectedPackIds]
  );

  const selectedPackUrls = useMemo(
    () => Array.from(new Set(selectedPacks.flatMap(pack => pack.urls))),
    [selectedPacks]
  );

  const selectedEstimatedRecipes = useMemo(
    () => selectedPacks.reduce((total, pack) => total + pack.estimatedRecipes, 0),
    [selectedPacks]
  );

  const isUrlValidForSelectedSite = useMemo(() => {
    const trimmed = url.trim();
    return trimmed.length > 0 && batchImportService.validateUrlForSite(trimmed, selectedSite);
  }, [url, selectedSite]);

  const canQueueUrlMode = isUrlValidForSelectedSite && !isPreflightLoading && !!preflight;
  const canQueueReImportMode = !isLoadingReImportCount && !reImportCountError && reImportableCount > 0;
  const canQueueQuickStartMode = selectedPackUrls.length > 0;

  const canQueueCurrentMode = mode === 'url'
    ? canQueueUrlMode
    : mode === 'reImport'
      ? canQueueReImportMode
      : canQueueQuickStartMode;

  const resetDialogState = () => {
    setMode('url');
    setUrl('');
    setSelectedSite('allrecipes');
    setMaxRecipes('');
    setMaxDepth('');
    setAdvancedOpen(false);

    setPreflight(null);
    setIsPreflightLoading(false);
    setPreflightError(null);

    setReImportableCount(0);
    setIsLoadingReImportCount(false);
    setReImportCountError(null);
    setReImportLastUpdatedAt(null);

    setSelectedPackIds([]);
    setQueueingProgress(null);

    setIsQueueing(false);
    setError(null);
    setQueueResult(null);

    setConfirmation({ open: false, action: null, title: '', body: '' });
    existingUrlsRef.current = null;
  };

  const loadExistingUrls = async () => {
    if (existingUrlsRef.current) {
      return existingUrlsRef.current;
    }

    const urls = await getExistingRecipeUrls();
    existingUrlsRef.current = urls;
    return urls;
  };

  const loadReImportableCount = async () => {
    setIsLoadingReImportCount(true);
    setReImportCountError(null);

    try {
      const count = await reImportService.getReImportableRecipesCount({ throwOnError: true });
      setReImportableCount(count);
      setReImportLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setReImportableCount(0);
      setReImportCountError(err instanceof Error ? err.message : 'Failed to load re-importable recipes count');
    } finally {
      setIsLoadingReImportCount(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetDialogState();
      return;
    }

    void loadReImportableCount();
  }, [open]);

  useEffect(() => {
    if (!open || queueResult) {
      return;
    }

    if (mode === 'url') {
      urlInputRef.current?.focus();
      return;
    }

    if (mode === 'reImport') {
      reImportButtonRef.current?.focus();
      return;
    }

    if (mode === 'quickStart') {
      quickStartHeadingRef.current?.focus();
    }
  }, [mode, open, queueResult]);

  useEffect(() => {
    if (open && queueResult) {
      queueResultHeadingRef.current?.focus();
    }
  }, [open, queueResult]);

  useEffect(() => {
    if (!open || mode !== 'url' || queueResult) {
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setPreflight(null);
      setPreflightError(null);
      setIsPreflightLoading(false);
      return;
    }

    const detectedSite = batchImportService.detectSiteFromUrl(trimmedUrl);
    if (detectedSite && detectedSite !== selectedSite) {
      setSelectedSite(detectedSite);
    }

    if (!batchImportService.validateUrlForSite(trimmedUrl, selectedSite)) {
      setPreflight(null);
      setPreflightError(null);
      setIsPreflightLoading(false);
      return;
    }

    setPreflightError(null);

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsPreflightLoading(true);

      try {
        const preview = await batchImportService.getImportPreflight({
          startUrl: trimmedUrl,
          maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
          maxDepth: maxDepth ? Number(maxDepth) : undefined,
        });

        if (!isCancelled) {
          setPreflight(preview);
        }
      } catch (err) {
        if (!isCancelled) {
          setPreflight(null);
          setPreflightError(err instanceof Error ? err.message : 'Failed to load import preview');
        }
      } finally {
        if (!isCancelled) {
          setIsPreflightLoading(false);
        }
      }
    }, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [open, mode, queueResult, url, selectedSite, maxRecipes, maxDepth]);

  const queueUrlImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Enter a category URL before queueing.');
      return;
    }

    setError(null);
    setIsQueueing(true);

    try {
      const existingUrls = await loadExistingUrls();
      const request: BatchImportRequest = {
        startUrl: trimmedUrl,
        maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
        maxDepth: maxDepth ? Number(maxDepth) : undefined,
        existingUrls,
      };

      const description = importQueueService.getTaskDescription(request);
      const taskId = await dispatch(addToQueue({ description, request })).unwrap();

      onTaskAdded?.(taskId);

      setQueueResult({
        mode: 'url',
        taskIds: [taskId],
        requested: 1,
        added: 1,
        failures: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue URL import');
    } finally {
      setIsQueueing(false);
    }
  };

  const queueReImport = async () => {
    if (reImportableCount <= 0) {
      setError('No recipes are available for re-import.');
      return;
    }

    setError(null);
    setIsQueueing(true);

    try {
      const request: ReImportRequest = {
        maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
      };

      const description = reImportService.getTaskDescription(request);
      const taskId = await reImportService.addToQueue(description, request);

      onTaskAdded?.(taskId);

      setQueueResult({
        mode: 'reImport',
        taskIds: [taskId],
        requested: 1,
        added: 1,
        failures: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue re-import task');
    } finally {
      setIsQueueing(false);
    }
  };

  const queueQuickStart = async () => {
    if (selectedPackUrls.length === 0) {
      setError('Select at least one pack before queueing.');
      return;
    }

    setError(null);
    setQueueingProgress({ processed: 0, total: selectedPackUrls.length });
    setIsQueueing(true);

    try {
      const result = await dispatch(addMultipleToQueue({
        urls: selectedPackUrls,
        options: {
          maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
          maxDepth: maxDepth ? Number(maxDepth) : undefined,
        },
        onProgress: progress => {
          setQueueingProgress({
            processed: progress.processed,
            total: progress.total,
          });
        },
      })).unwrap();

      result.taskIds.forEach(taskId => onTaskAdded?.(taskId));

      setQueueResult({
        mode: 'quickStart',
        taskIds: result.taskIds,
        requested: selectedPackUrls.length,
        added: result.totalAdded,
        failures: result.errors.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue quick-start packs');
    } finally {
      setIsQueueing(false);
      setQueueingProgress(null);
    }
  };

  const openConfirmation = (action: BatchImportMode, title: string, body: string) => {
    setConfirmation({
      open: true,
      action,
      title,
      body,
    });
  };

  const closeConfirmation = () => {
    setConfirmation({ open: false, action: null, title: '', body: '' });
  };

  const handleQueueAction = async () => {
    if (mode === 'url') {
      if (!preflight) {
        setError('Wait for import preview before queueing this URL.');
        return;
      }

      if (
        preflight.estimatedNewRecipes > RECIPE_CONFIRM_THRESHOLD ||
        preflight.estimatedCategories > CATEGORY_CONFIRM_THRESHOLD
      ) {
        openConfirmation(
          'url',
          'Confirm large URL import',
          `This URL is estimated at ${preflight.estimatedNewRecipes} new recipes across ${preflight.estimatedCategories} categories. Queue anyway?`
        );
        return;
      }

      await queueUrlImport();
      return;
    }

    if (mode === 'reImport') {
      if (reImportableCount > REIMPORT_CONFIRM_THRESHOLD) {
        openConfirmation(
          'reImport',
          'Confirm large re-import',
          `This will queue re-import for ${reImportableCount} recipes. Continue?`
        );
        return;
      }

      await queueReImport();
      return;
    }

    if (selectedPackUrls.length > QUICK_START_URL_CONFIRM_THRESHOLD) {
      openConfirmation(
        'quickStart',
        'Confirm quick-start workload',
        `${selectedPackUrls.length} category URLs are selected. Continue queueing these packs?`
      );
      return;
    }

    await queueQuickStart();
  };

  const handleConfirmQueue = async () => {
    const action = confirmation.action;
    closeConfirmation();

    if (action === 'url') {
      await queueUrlImport();
    } else if (action === 'reImport') {
      await queueReImport();
    } else if (action === 'quickStart') {
      await queueQuickStart();
    }
  };

  const handleOpenQueue = () => {
    window.dispatchEvent(new CustomEvent('justcooked:open-import-queue'));
    onOpenQueue?.();
  };

  const togglePack = (packId: string) => {
    setSelectedPackIds(previous => {
      if (previous.includes(packId)) {
        return previous.filter(id => id !== packId);
      }
      return [...previous, packId];
    });
  };

  const renderAdvancedOptions = (showMaxDepth: boolean) => (
    <Accordion
      expanded={advancedOpen}
      onChange={(_, expanded) => setAdvancedOpen(expanded)}
      data-testid="batchImportDialog-accordion-advanced"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Advanced</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Max Recipes"
            type="number"
            value={maxRecipes}
            onChange={event => setMaxRecipes(event.target.value === '' ? '' : Number(event.target.value))}
            inputProps={{ min: 1, max: 10000 }}
            helperText="Optional cap for imported recipes"
            data-testid="batchImportDialog-input-maxRecipes"
            fullWidth
          />
          {showMaxDepth && (
            <TextField
              label="Max Depth"
              type="number"
              value={maxDepth}
              onChange={event => setMaxDepth(event.target.value === '' ? '' : Number(event.target.value))}
              inputProps={{ min: 1, max: 10 }}
              helperText="Optional crawl depth limit"
              data-testid="batchImportDialog-input-maxDepth"
              fullWidth
            />
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  const filteredSuggestions = suggestions.filter(suggestion =>
    batchImportService.validateUrlForSite(suggestion.url, selectedSite)
  );

  const queueAnnouncement = queueResult
    ? `Queued ${queueResult.added} of ${queueResult.requested} requested tasks.`
    : '';

  const preflightAnnouncement = preflight
    ? `Preview loaded. ${preflight.estimatedNewRecipes} new recipes estimated.`
    : preflightError
      ? `Preview failed. ${preflightError}`
      : '';

  const srAnnouncement = `${queueAnnouncement} ${preflightAnnouncement}`.trim();

  const modeSubhead = mode === 'url'
    ? 'Paste one supported listing URL and review the preview before queueing.'
    : mode === 'reImport'
      ? 'Re-import existing recipes with the latest parser behavior.'
      : 'Pick curated packs and queue them in controlled batches.';

  const primaryButtonText = mode === 'url'
    ? 'Queue Import'
    : mode === 'reImport'
      ? 'Queue Re-import'
      : 'Queue Selected Packs';

  return (
    <Dialog
      open={open}
      onClose={isQueueing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      data-testid="batchImportDialog-dialog-main"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QueueIcon />
          <Typography variant="h6" component="span">Batch Import</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box aria-live="polite" sx={srOnlySx}>
          {srAnnouncement}
        </Box>

        {!queueResult && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Choose Import Type
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                {(['url', 'reImport', 'quickStart'] as BatchImportMode[]).map(cardMode => {
                  const active = mode === cardMode;
                  const copy = MODE_CARD_COPY[cardMode];

                  return (
                    <Card
                      key={cardMode}
                      variant="outlined"
                      sx={{
                        flex: 1,
                        borderColor: active ? 'primary.main' : 'divider',
                        background: active
                          ? 'linear-gradient(145deg, rgba(25,118,210,0.12), rgba(25,118,210,0.03))'
                          : 'transparent',
                      }}
                    >
                      <CardActionArea
                        onClick={() => {
                          setMode(cardMode);
                          setError(null);
                        }}
                        data-testid={`batchImportDialog-card-mode-${cardMode}`}
                      >
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            {copy.icon}
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{copy.title}</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {copy.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Stack>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                {MODE_CARD_COPY[mode].title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {modeSubhead}
              </Typography>

              {mode === 'url' && (
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    value={selectedSite}
                    exclusive
                    onChange={(_, value: BatchImportSite | null) => {
                      if (value) {
                        setSelectedSite(value);
                      }
                    }}
                    size="small"
                    color="primary"
                    aria-label="Supported import sites"
                  >
                    {Object.entries(SITE_LABELS).map(([siteKey, label]) => (
                      <ToggleButton
                        key={siteKey}
                        value={siteKey}
                        data-testid={`batchImportDialog-site-${siteKey}`}
                      >
                        {label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <TextField
                    fullWidth
                    inputRef={urlInputRef}
                    label="Category URL"
                    value={url}
                    onChange={event => setUrl(event.target.value)}
                    placeholder={SITE_EXAMPLES[selectedSite]}
                    error={url.length > 0 && !isUrlValidForSelectedSite}
                    helperText={
                      url.length > 0 && !isUrlValidForSelectedSite
                        ? `Use a valid ${SITE_LABELS[selectedSite]} listing URL.`
                        : `Example: ${SITE_EXAMPLES[selectedSite]}`
                    }
                    data-testid="batchImportDialog-input-url"
                  />

                  {renderAdvancedOptions(true)}

                  {isPreflightLoading && (
                    <Box data-testid="batchImportDialog-preflight-loading">
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Building import preview...
                      </Typography>
                      <LinearProgress />
                    </Box>
                  )}

                  {preflightError && (
                    <Alert severity="warning" data-testid="batchImportDialog-preflight-error">
                      {preflightError}
                    </Alert>
                  )}

                  {preflight && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 1.5,
                        backgroundColor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      data-testid="batchImportDialog-preflight-panel"
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Import Preview
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1, mb: 1.5 }}>
                        <Chip label={`${preflight.estimatedCategories} categories`} size="small" />
                        <Chip label={`${preflight.estimatedRecipes} discovered`} size="small" />
                        <Chip label={`${preflight.estimatedDuplicates} duplicates`} size="small" />
                        <Chip
                          color="primary"
                          variant="outlined"
                          label={`${preflight.estimatedNewRecipes} estimated new`}
                          size="small"
                        />
                        <Chip
                          label={`${preflight.estimatedEtaMinMinutes}-${preflight.estimatedEtaMaxMinutes} min ETA`}
                          size="small"
                        />
                      </Stack>

                      {preflight.warnings.length > 0 && (
                        <Stack spacing={0.5}>
                          {preflight.warnings.map(warning => (
                            <Typography key={warning} variant="caption" color="warning.main" sx={{ display: 'block' }}>
                              {warning}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Suggested examples for {SITE_LABELS[selectedSite]}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                      {filteredSuggestions.map(suggestion => (
                        <Chip
                          key={suggestion.url}
                          label={suggestion.name}
                          onClick={() => setUrl(suggestion.url)}
                          variant="outlined"
                          data-testid={`batchImportDialog-suggestion-${suggestion.name.replace(/\s+/g, '-').toLowerCase()}`}
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              )}

              {mode === 'reImport' && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Re-import updates existing recipes that have source URLs using the latest parser logic.
                  </Typography>

                  {renderAdvancedOptions(false)}

                  {isLoadingReImportCount && (
                    <Box data-testid="batchImportDialog-reimport-loading">
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Loading re-importable recipe count...
                      </Typography>
                      <LinearProgress />
                    </Box>
                  )}

                  {reImportCountError ? (
                    <Alert
                      severity="warning"
                      action={
                        <Button color="inherit" size="small" onClick={() => void loadReImportableCount()}>
                          Retry
                        </Button>
                      }
                      data-testid="batchImportDialog-reimport-error"
                    >
                      {reImportCountError}
                    </Alert>
                  ) : (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {reImportableCount} recipes available for re-import
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        This queues background tasks and keeps your current recipe list intact.
                      </Typography>
                      {reImportLastUpdatedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Last checked: {new Date(reImportLastUpdatedAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  )}

                  <Button
                    ref={reImportButtonRef}
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => void loadReImportableCount()}
                    disabled={isLoadingReImportCount}
                  >
                    Refresh Count
                  </Button>
                </Stack>
              )}

              {mode === 'quickStart' && (
                <Stack spacing={2}>
                  <Typography
                    tabIndex={-1}
                    ref={quickStartHeadingRef}
                    variant="body2"
                    color="text.secondary"
                  >
                    Curated packs are grouped category URLs. Multi-select packs to queue a controlled batch.
                  </Typography>

                  {renderAdvancedOptions(true)}

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                    {quickStartPacks.map(pack => {
                      const selected = selectedPackIds.includes(pack.id);

                      return (
                        <Card
                          key={pack.id}
                          variant="outlined"
                          sx={{
                            borderColor: selected ? 'primary.main' : 'divider',
                            backgroundColor: selected ? 'action.selected' : 'transparent',
                          }}
                        >
                          <CardActionArea
                            onClick={() => togglePack(pack.id)}
                            data-testid={`batchImportDialog-pack-${pack.id}`}
                          >
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {pack.name}
                                </Typography>
                                <Chip label={`${pack.urls.length} URLs`} size="small" />
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {pack.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ~{pack.estimatedRecipes} recipes estimated
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'background.default',
                    }}
                    data-testid="batchImportDialog-quickstart-summary"
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Selection Summary
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedPacks.length} packs selected · {selectedPackUrls.length} unique URLs · ~{selectedEstimatedRecipes} recipes
                    </Typography>
                    {selectedPackUrls.length > QUICK_START_URL_CONFIRM_THRESHOLD && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                        Large quick-start batch selected. Confirmation will be required.
                      </Typography>
                    )}
                  </Box>

                  {queueingProgress && (
                    <Box data-testid="batchImportDialog-quickstart-progress">
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Queueing {queueingProgress.processed} of {queueingProgress.total} URLs
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={queueingProgress.total > 0 ? (queueingProgress.processed / queueingProgress.total) * 100 : 0}
                      />
                    </Box>
                  )}
                </Stack>
              )}
            </Box>

            <Alert severity="info" icon={<GridViewIcon />}>
              Use the queue button in the desktop app bar to watch progress and manage active tasks.
            </Alert>

            {error && (
              <Alert severity="error" data-testid="batchImportDialog-alert-error">
                {error}
              </Alert>
            )}
          </Stack>
        )}

        {queueResult && (
          <Stack spacing={2.5}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'success.main',
                background: 'linear-gradient(145deg, rgba(46,125,50,0.15), rgba(46,125,50,0.04))',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <DoneAllIcon color="success" />
                <Typography ref={queueResultHeadingRef} tabIndex={-1} variant="h6" sx={{ outline: 'none' }}>
                  Queued
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Added {queueResult.added} of {queueResult.requested} task{queueResult.requested === 1 ? '' : 's'} to the import queue.
              </Typography>
              {queueResult.failures > 0 && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  {queueResult.failures} task{queueResult.failures === 1 ? '' : 's'} failed to queue.
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenQueue}
                data-testid="batchImportDialog-button-openQueue"
              >
                Open Queue
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setQueueResult(null);
                  setError(null);
                }}
                data-testid="batchImportDialog-button-queueAnother"
              >
                Queue Another
              </Button>
              <Button
                variant="contained"
                onClick={onClose}
                data-testid="batchImportDialog-button-done"
              >
                Done
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      {!queueResult && (
        <DialogActions>
          <Button
            onClick={onClose}
            disabled={isQueueing}
            data-testid="batchImportDialog-button-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleQueueAction()}
            disabled={!canQueueCurrentMode || isQueueing}
            startIcon={<QueueIcon />}
            data-testid="batchImportDialog-button-addToQueue"
          >
            {isQueueing ? 'Queueing...' : primaryButtonText}
          </Button>
        </DialogActions>
      )}

      <Dialog
        open={confirmation.open}
        onClose={isQueueing ? undefined : closeConfirmation}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{confirmation.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmation.body}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmation} disabled={isQueueing}>Back</Button>
          <Button variant="contained" onClick={() => void handleConfirmQueue()} disabled={isQueueing}>
            Queue Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default BatchImportDialog;
