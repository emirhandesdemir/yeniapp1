import {configureGenkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the pre-v1.0 syntax for Genkit initialization.
// It is used to ensure compatibility with Next.js v14.
configureGenkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
