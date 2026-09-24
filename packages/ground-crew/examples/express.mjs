import express from 'express';
import { createChartHandler } from '@lunaterra/ground-crew';
import { validateChartSpec, ChartValidationError } from '@lunaterra/declarative';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.post('/chart.png', createChartHandler({
  getChart: (request) => validateChartSpec(request.body?.chart),
  output: { width: 900, height: 360 },
}));
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  response.status(error instanceof ChartValidationError ? 422 : 500).json({ error: error.message });
});
app.listen(3000, '127.0.0.1', () => console.log('POST a chart specification to http://127.0.0.1:3000/chart.png'));
